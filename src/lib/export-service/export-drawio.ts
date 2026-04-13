import type { Component, Diagram, DiagramModel } from "@/features/diagram";
import {
  diagramWithResolvedScene,
  isApiGroupComponent,
  isAwsComponent,
  isC4Component,
  isEndpointComponent,
  isDbTableComponent,
  isJsonViewerComponent,
  isSvgComponent,
  isUnknownComponent,
  isNoteComponent,
  isPanelComponent,
  ServiceDefinition,
} from "@/features/diagram";
import { CONFIG } from "./constants";
import { cellBuilders } from "./cell-builders";
import { buildEdgeCell } from "./edge-builder";
import {
  type BoundingBox,
  computeBoundingBox,
  computeScaleFactor,
  DRAWIO_MIN_MARGIN,
  DRAWIO_ROOT_MIN_GAP,
  getContainerIds,
  getExportGeometry,
  isRootExportNode,
  resolveOverlaps,
  type RootPosition,
} from "./geometry";
import { validateDiagram } from "./validate-diagram";
import { escXml } from "./xml-utils";


export function extractMxGraphModelXml(fullDrawioFile: string): string {
  const m = fullDrawioFile.match(/<mxGraphModel\b[\s\S]*?<\/mxGraphModel>/);
  return m ? m[0] : fullDrawioFile;
}


function expandWithContainerAncestors(
  ids: string[],
  components: Record<string, Component>,
): string[] {
  const out = new Set(ids);
  for (const id of ids) {
    let p = components[id]?.parentId;
    while (p) {
      const parent = components[p];
      if (!parent) break;
      if (isPanelComponent(parent) || isApiGroupComponent(parent)) {
        out.add(p);
      }
      p = parent.parentId;
    }
  }
  return [...out];
}

function drawParentId(
  comp: Component,
  containerIds: Set<string>,
): string {
  if (comp.parentId && containerIds.has(comp.parentId)) {
    return comp.parentId;
  }
  return "1";
}

function exportDepth(
  id: string,
  components: Record<string, Component>,
  containerIds: Set<string>,
  memo: Map<string, number>,
): number {
  if (memo.has(id)) return memo.get(id)!;
  const c = components[id];
  if (!c) {
    memo.set(id, 0);
    return 0;
  }
  const parent = drawParentId(c, containerIds);
  if (parent === "1") {
    memo.set(id, 0);
    return 0;
  }
  const d = 1 + exportDepth(parent, components, containerIds, memo);
  memo.set(id, d);
  return d;
}

function sortExportOrder(
  ids: string[],
  components: Record<string, Component>,
  containerIds: Set<string>,
  layoutMap: Map<string, { x: number; y: number }>,
): string[] {
  const memo = new Map<string, number>();
  return [...ids].sort((a, b) => {
    const da = exportDepth(a, components, containerIds, memo);
    const db = exportDepth(b, components, containerIds, memo);
    if (da !== db) return da - db;
    const la = layoutMap.get(a) ?? { x: 0, y: 0 };
    const lb = layoutMap.get(b) ?? { x: 0, y: 0 };
    if (la.y !== lb.y) return la.y - lb.y;
    return la.x - lb.x;
  });
}

function transformCanvasPoint(
  x: number,
  y: number,
  bbox: BoundingBox,
  scale: number,
): { x: number; y: number } {
  return {
    x: Math.round((x - bbox.minX) * scale + DRAWIO_MIN_MARGIN),
    y: Math.round((y - bbox.minY) * scale + DRAWIO_MIN_MARGIN),
  };
}

export function exportDrawio(
  diagram: Diagram | DiagramModel,
  serviceRegistry: Record<string, ServiceDefinition>,
  options?: { componentIds?: string[] },
): string {
  const resolved = diagramWithResolvedScene(diagram);
  validateDiagram(resolved);

  const shouldFilter =
    options?.componentIds !== undefined && options!.componentIds.length > 0;

  const expandedIds = shouldFilter
    ? expandWithContainerAncestors(options!.componentIds!, resolved.snapshot.components)
    : null;

  const diagramForExport: Diagram | DiagramModel = shouldFilter
    ? (() => {
        const idSet = new Set(expandedIds!);
        const filteredComponents = Object.fromEntries(
          Object.entries(resolved.snapshot.components).filter(([id]) => idSet.has(id)),
        );
        const filteredConnections = Object.fromEntries(
          Object.entries(resolved.snapshot.connections).filter(
            ([, conn]) => idSet.has(conn.sourceId) && idSet.has(conn.targetId),
          ),
        );

        return {
          ...resolved,
          snapshot: {
            ...resolved.snapshot,
            components: filteredComponents,
            connections: filteredConnections,
          },
          nodeLayouts: Object.fromEntries(
            Object.entries(resolved.nodeLayouts).filter(([id]) => idSet.has(id)),
          ),
          edgeLayouts: Object.fromEntries(
            Object.entries(resolved.edgeLayouts).filter(
              ([connectionId]) => filteredConnections[connectionId] !== undefined,
            ),
          ),
        };
      })()
    : resolved;

  const { components, connections } = diagramForExport.snapshot;

  const layoutMap = new Map(Object.entries(diagramForExport.nodeLayouts));
  const containerIds = getContainerIds(components);

  const componentIdsWithLayout = Object.keys(components).filter((id) => layoutMap.has(id));

  const bbox = computeBoundingBox(
    componentIdsWithLayout,
    layoutMap,
    components,
    containerIds,
  );

  const rootIds = componentIdsWithLayout.filter((id) =>
    isRootExportNode(components[id], containerIds),
  );
  const rootNodeCount = rootIds.length;
  const scale = computeScaleFactor(bbox, rootNodeCount);

  const rootPositions = new Map<string, RootPosition>();
  for (const id of rootIds) {
    const nl = layoutMap.get(id);
    if (!nl) continue;
    const raw = getExportGeometry(nl);
    const w = raw.width > 0 ? raw.width : (nl.width ?? CONFIG.minDimensions.c4.width);
    const h = raw.height > 0 ? raw.height : (nl.height ?? CONFIG.minDimensions.c4.height);
    const x = (raw.x - bbox.minX) * scale + DRAWIO_MIN_MARGIN;
    const y = (raw.y - bbox.minY) * scale + DRAWIO_MIN_MARGIN;
    rootPositions.set(id, { x, y, width: w, height: h });
  }

  const resolvedRoot = resolveOverlaps(rootPositions, DRAWIO_ROOT_MIN_GAP);

  const exportedWidth = Math.ceil(bbox.width * scale + DRAWIO_MIN_MARGIN * 2);
  const exportedHeight = Math.ceil(bbox.height * scale + DRAWIO_MIN_MARGIN * 2);
  const pageWidth = Math.max(exportedWidth, CONFIG.grid.pageWidth);
  const pageHeight = Math.max(exportedHeight, CONFIG.grid.pageHeight);

  const orderedIds = sortExportOrder(
    componentIdsWithLayout,
    components,
    containerIds,
    layoutMap as Map<string, { x: number; y: number }>,
  );

  const vertexCells: string[] = [];

  for (const id of orderedIds) {
    const c = components[id];
    const nl = layoutMap.get(id);
    if (!c || !nl) continue;

    const parentMx = drawParentId(c, containerIds);
    const rawGeometry = getExportGeometry(nl);

    const isChildNode = !!(c.parentId && containerIds.has(c.parentId));
    const geometry = isChildNode
      ? { ...rawGeometry }
      : (() => {
          const pos = resolvedRoot.get(id);
          if (pos) {
            return {
              ...rawGeometry,
              x: pos.x,
              y: pos.y,
            };
          }
          return {
            ...rawGeometry,
            x: (rawGeometry.x - bbox.minX) * scale + DRAWIO_MIN_MARGIN,
            y: (rawGeometry.y - bbox.minY) * scale + DRAWIO_MIN_MARGIN,
          };
        })();

    const serviceName = c.serviceId
      ? serviceRegistry[c.serviceId]?.name
      : undefined;

    let cell: string;

    if (isPanelComponent(c)) {
      const pw = geometry.width || CONFIG.defaults.panelWidth;
      const ph = geometry.height || CONFIG.defaults.panelHeight;
      cell = cellBuilders.panel.build(
        c,
        { ...geometry, width: pw, height: ph },
        parentMx,
      );
    } else if (isApiGroupComponent(c)) {
      cell = cellBuilders.apiGroup.build(c, geometry, parentMx);
    } else if (isAwsComponent(c)) {
      cell = cellBuilders.aws.build(c, geometry, parentMx);
    } else if (isC4Component(c)) {
      cell = cellBuilders.c4.build(c, geometry, parentMx, serviceName);
    } else if (isEndpointComponent(c)) {
      cell = cellBuilders.endpoint.build(c, geometry, parentMx);
    } else if (isDbTableComponent(c)) {
      cell = cellBuilders.dbTable.build(c, geometry, parentMx);
    } else if (isJsonViewerComponent(c)) {
      cell = cellBuilders.jsonViewer.build(c, geometry, parentMx);
    } else if (isNoteComponent(c)) {
      const finalWidth = geometry.width || CONFIG.defaults.noteWidth;
      const finalHeight = geometry.height || CONFIG.defaults.noteHeight;
      cell = cellBuilders.note.build(
        c,
        { ...geometry, width: finalWidth, height: finalHeight },
        parentMx,
      );
    } else if (isUnknownComponent(c) || isSvgComponent(c)) {
      
      
      throw new Error(`Unsupported component for draw.io export: ${c.type}`);
    } else {
      const _: never = c;
      throw new Error("Unsupported component for draw.io export");
    }

    vertexCells.push(cell);
  }

  const edgeLayoutByConnectionId = diagramForExport.edgeLayouts;

  const edgeCells: string[] = [];
  for (const conn of Object.values(connections)) {
    const edgeLayout = edgeLayoutByConnectionId[conn.id];
    const waypoints =
      edgeLayout && edgeLayout.waypoints.length > 0
        ? edgeLayout.waypoints
            .map((point) => transformCanvasPoint(point.x, point.y, bbox, scale))
        : [];
    edgeCells.push(buildEdgeCell(conn, { waypoints }));
  }

  const allCells = [
    `<mxCell id="0"/>`,
    `<mxCell id="1" parent="0"/>`,
    ...vertexCells,
    ...edgeCells,
  ].join("");

  const slug = escXml(diagramForExport.name);

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<mxfile><diagram name="${slug}">` +
    `<mxGraphModel dx="${CONFIG.grid.dx}" dy="${CONFIG.grid.dy}" grid="1" gridSize="${CONFIG.grid.gridSize}" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="0" fit="1" pageScale="1" pageWidth="${pageWidth}" pageHeight="${pageHeight}" math="0" shadow="0" background="#ffffff">` +
    `<root>${allCells}</root>` +
    `</mxGraphModel></diagram></mxfile>`
  );
}
