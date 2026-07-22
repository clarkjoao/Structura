/**
 * Export Draw.io Module
 *
 * Converts PluginComponentSnapshot and PluginConnectionSnapshot to draw.io XML format.
 * This is a self-contained implementation that mirrors the main app's export logic.
 */

import type { DiagramSnapshot, PluginComponentSnapshot, PluginConnectionSnapshot } from "../../types/plugin.types";
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
  isPanelComponent,
  isApiGroupComponent,
  isAwsComponent,
  isC4Component,
  isEndpointComponent,
  isDbTableComponent,
  isJsonViewerComponent,
  isNoteComponent,
} from "./geometry";
import { escXml } from "./xml-utils";

/**
 * Extract mxGraphModel from full draw.io file
 */
export function extractMxGraphModelXml(fullDrawioFile: string): string {
  const m = fullDrawioFile.match(/<mxGraphModel\b[\s\S]*?<\/mxGraphModel>/);
  return m ? m[0] : fullDrawioFile;
}

function expandWithContainerAncestors(
  ids: string[],
  components: readonly PluginComponentSnapshot[],
): string[] {
  const out = new Set(ids);
  for (const id of ids) {
    let p = components.find(c => c.id === id)?.parentId;
    while (p) {
      const parent = components.find(c => c.id === p);
      if (!parent) break;
      if (isPanelComponent(parent) || isApiGroupComponent(parent)) {
        out.add(p);
      }
      p = parent.parentId;
    }
  }
  return [...out];
}

function drawParentId(comp: PluginComponentSnapshot, containerIds: Set<string>): string {
  if (comp.parentId && containerIds.has(comp.parentId)) {
    return comp.parentId;
  }
  return "1";
}

function exportDepth(
  id: string,
  components: readonly PluginComponentSnapshot[],
  containerIds: Set<string>,
  memo: Map<string, number>,
): number {
  if (memo.has(id)) return memo.get(id)!;
  const c = components.find(comp => comp.id === id);
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
  components: readonly PluginComponentSnapshot[],
  containerIds: Set<string>,
): PluginComponentSnapshot[] {
  const memo = new Map<string, number>();
  return [...components].sort((a, b) => {
    const da = exportDepth(a.id, components, containerIds, memo);
    const db = exportDepth(b.id, components, containerIds, memo);
    if (da !== db) return da - db;
    const la = a.position ?? { x: 0, y: 0 };
    const lb = b.position ?? { x: 0, y: 0 };
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

/**
 * Export a diagram snapshot to draw.io XML format
 * LeanIX expects ONLY mxGraphModel, NOT mxfile wrapper
 */
export function exportDrawio(
  diagram: DiagramSnapshot,
  options?: { componentIds?: string[] },
): string {
  const { components, connections } = diagram;

  // Validate
  if (!components || !connections) {
    throw new Error("Invalid diagram snapshot structure");
  }

  const shouldFilter = options?.componentIds !== undefined && options!.componentIds.length > 0;

  const filteredComponents = shouldFilter
    ? (() => {
        const expandedIds = expandWithContainerAncestors(options!.componentIds!, components);
        const idSet = new Set(expandedIds);
        return components.filter((c: PluginComponentSnapshot) => idSet.has(c.id));
      })()
    : [...components];

  const componentIds = filteredComponents.map((c: PluginComponentSnapshot) => c.id);

  const containerIds = getContainerIds(filteredComponents);

  // Components with positions
  const componentsWithPosition = filteredComponents.filter((c: PluginComponentSnapshot) => c.position !== null);

  const bbox = computeBoundingBox(filteredComponents, containerIds);

  const rootComponents = componentsWithPosition.filter((c: PluginComponentSnapshot) =>
    isRootExportNode(c, containerIds),
  );
  const rootNodeCount = rootComponents.length;
  const scale = computeScaleFactor(bbox, rootNodeCount);

  const rootPositions = new Map<string, RootPosition>();
  for (const c of rootComponents) {
    if (!c.position) continue;
    const raw = getExportGeometry(c);
    const w = raw.width > 0 ? raw.width : (c.size?.width ?? CONFIG.minDimensions.c4.width);
    const h = raw.height > 0 ? raw.height : (c.size?.height ?? CONFIG.minDimensions.c4.height);
    const x = (raw.x - bbox.minX) * scale + DRAWIO_MIN_MARGIN;
    const y = (raw.y - bbox.minY) * scale + DRAWIO_MIN_MARGIN;
    rootPositions.set(c.id, { x, y, width: w, height: h });
  }

  const resolvedRoot = resolveOverlaps(rootPositions, DRAWIO_ROOT_MIN_GAP);

  const exportedWidth = Math.ceil(bbox.width * scale + DRAWIO_MIN_MARGIN * 2);
  const exportedHeight = Math.ceil(bbox.height * scale + DRAWIO_MIN_MARGIN * 2);
  const pageWidth = Math.max(exportedWidth, CONFIG.grid.pageWidth);
  const pageHeight = Math.max(exportedHeight, CONFIG.grid.pageHeight);

  const orderedComponents = sortExportOrder(filteredComponents, containerIds);

  const vertexCells: string[] = [];

  for (const c of orderedComponents) {
    const parentMx = drawParentId(c, containerIds);
    const rawGeometry = getExportGeometry(c);

    const isChildNode = !!(c.parentId && containerIds.has(c.parentId));
    const geometry = isChildNode
      ? { ...rawGeometry }
      : (() => {
          const pos = resolvedRoot.get(c.id);
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

    let cell: string;

    if (isPanelComponent(c)) {
      const pw = geometry.width || CONFIG.defaults.panelWidth;
      const ph = geometry.height || CONFIG.defaults.panelHeight;
      cell = cellBuilders.panel.build(c, { ...geometry, width: pw, height: ph }, parentMx);
    } else if (isApiGroupComponent(c)) {
      cell = cellBuilders.apiGroup.build(c, geometry, parentMx);
    } else if (isAwsComponent(c)) {
      cell = cellBuilders.aws.build(c, geometry, parentMx);
    } else if (isC4Component(c)) {
      cell = cellBuilders.c4.build(c, geometry, parentMx);
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
    } else {
      // Generic fallback - use note style
      cell = cellBuilders.note.build(c, geometry, parentMx);
    }

    vertexCells.push(cell);
  }

  // Filter connections to only those where both source and target exist
  const validConnectionIds = new Set(componentIds);
  const filteredConnections = connections.filter(
    (c: PluginConnectionSnapshot) => validConnectionIds.has(c.sourceId) && validConnectionIds.has(c.targetId),
  );

  const edgeCells: string[] = [];
  for (const conn of filteredConnections) {
    edgeCells.push(buildEdgeCell(conn));
  }

  const allCells = [
    `<mxCell id="0"/>`,
    `<mxCell id="1" parent="0"/>`,
    ...vertexCells,
    ...edgeCells,
  ].join("");

  const slug = escXml(diagram.name);

  // LeanIX expects ONLY mxGraphModel, NOT mxfile wrapper
  return (
    `<mxGraphModel dx="${CONFIG.grid.dx}" dy="${CONFIG.grid.dy}" grid="1" gridSize="${CONFIG.grid.gridSize}" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="0" fit="1" pageScale="1" pageWidth="${pageWidth}" pageHeight="${pageHeight}" math="0" shadow="0" background="#ffffff">` +
    `<root>${allCells}</root>` +
    `</mxGraphModel>`
  );
}
