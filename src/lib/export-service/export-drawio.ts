import type { Diagram } from "@/features/diagram";
import {
  isPanelComponent,
  isC4Component,
  isAwsComponent,
  ServiceDefinition,
} from "@/features/diagram";
import { CONFIG } from "./constants";
import { cellBuilders } from "./cell-builders";
import { buildEdgeCell } from "./edge-builder";
import { calculateGeometry } from "./geometry";
import type { PanelLayout } from "./types";
import { validateDiagram } from "./validate-diagram";
import { escXml } from "./xml-utils";

export function exportDrawio(
  diagram: Diagram,
  serviceRegistry: Record<string, ServiceDefinition>,
  options?: { componentIds?: string[] },
): string {
  validateDiagram(diagram);

  const shouldFilter =
    options?.componentIds !== undefined && options.componentIds.length > 0;

  const idSet = shouldFilter ? new Set(options!.componentIds) : null;

  const diagramForExport: Diagram = shouldFilter
    ? (() => {
        const filteredComponents = Object.fromEntries(
          Object.entries(diagram.snapshot.components).filter(([id]) =>
            idSet!.has(id),
          ),
        );
        const filteredConnections = Object.fromEntries(
          Object.entries(diagram.snapshot.connections).filter(
            ([, conn]) => idSet!.has(conn.sourceId) && idSet!.has(conn.targetId),
          ),
        );

        return {
          ...diagram,
          snapshot: {
            ...diagram.snapshot,
            components: filteredComponents,
            connections: filteredConnections,
          },
          nodeLayouts: Object.fromEntries(
            Object.entries(diagram.nodeLayouts).filter(([id]) => idSet!.has(id)),
          ),
        };
      })()
    : diagram;

  const { components, connections } = diagramForExport.snapshot;

  const layoutMap = new Map(Object.entries(diagramForExport.nodeLayouts));

  const panelIds = new Set<string>();
  const panelOrder: string[] = [];
  const childrenByPanel = new Map<string, string[]>();
  const standalCells: string[] = [];
  const edgeCells: string[] = [];
  const panelLayouts = new Map<string, PanelLayout>();

  for (const c of Object.values(components)) {
    if (isPanelComponent(c)) {
      panelIds.add(c.id);
      panelOrder.push(c.id);
      const nl = layoutMap.get(c.id);
      if (nl) {
        panelLayouts.set(c.id, {
          x: nl.x,
          y: nl.y,
          w: nl.width ?? CONFIG.defaults.panelWidth,
          h: nl.height ?? CONFIG.defaults.panelHeight,
        });
      }
    }
  }

  for (const c of Object.values(components)) {
    if (isPanelComponent(c)) continue;

    const nl = layoutMap.get(c.id);
    if (!nl) continue;

    const serviceName = c.serviceId
      ? serviceRegistry[c.serviceId]?.name
      : undefined;
    const parentNl =
      c.parentId && panelIds.has(c.parentId)
        ? layoutMap.get(c.parentId)
        : undefined;
    const parentId = c.parentId && panelIds.has(c.parentId) ? c.parentId : "1";

    const geometry = calculateGeometry(nl, parentNl, false);

    let cell: string;

    if (isAwsComponent(c)) {
      cell = cellBuilders.aws.build(c, geometry, parentId);
    } else if (isC4Component(c)) {
      cell = cellBuilders.c4.build(c, geometry, parentId, serviceName);
    } else {
      const finalWidth = geometry.width ?? CONFIG.defaults.noteWidth;
      const finalHeight = geometry.height ?? CONFIG.defaults.noteHeight;
      cell = cellBuilders.note.build(
        c,
        { ...geometry, width: finalWidth, height: finalHeight },
        parentId,
      );
    }

    if (parentId !== "1") {
      const arr = childrenByPanel.get(parentId) ?? [];
      arr.push(cell);
      childrenByPanel.set(parentId, arr);
    } else {
      standalCells.push(cell);
    }
  }

  const panelAndChildCells: string[] = [];
  for (const panelId of panelOrder) {
    const pl = panelLayouts.get(panelId);
    if (pl) {
      const panelComp = components[panelId];
      if (panelComp && isPanelComponent(panelComp)) {
        const panelGeometry = { x: pl.x, y: pl.y, width: pl.w, height: pl.h };
        panelAndChildCells.push(
          cellBuilders.panel.build(panelComp, panelGeometry, "1"),
        );
      }
    }
    const kids = childrenByPanel.get(panelId) ?? [];
    panelAndChildCells.push(...kids);
  }

  for (const conn of Object.values(connections)) {
    edgeCells.push(buildEdgeCell(conn));
  }

  const allCells = [
    `<mxCell id="0"/>`,
    `<mxCell id="1" parent="0"/>`,
    ...panelAndChildCells,
    ...standalCells,
    ...edgeCells,
  ].join("");

  const slug = escXml(diagramForExport.name);

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<mxfile><diagram name="${slug}">` +
    `<mxGraphModel dx="${CONFIG.grid.dx}" dy="${CONFIG.grid.dy}" grid="1" gridSize="${CONFIG.grid.gridSize}" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="0" pageScale="1" pageWidth="${CONFIG.grid.pageWidth}" pageHeight="${CONFIG.grid.pageHeight}" math="0" shadow="0" background="#ffffff">` +
    `<root>${allCells}</root>` +
    `</mxGraphModel></diagram></mxfile>`
  );
}
