import { buildCell } from "./cell-builders";
import { CONFIG } from "./constants";
import { buildEdgeCell } from "./edge-builder";
import {
  type BoundingBox,
  computeBoundingBox,
  DRAWIO_MIN_MARGIN,
  getContainerIds,
} from "./geometry";
import type { ExportModel, ExportNode } from "./model";
import { escXml } from "./xml-utils";

/** Which XML envelope to emit: full `<mxfile>` (app) or bare `<mxGraphModel>` (LeanIX). */
export type MxGraphWrapper = "mxfile" | "mxgraphModel";

function drawParentId(node: ExportNode, containerIds: Set<string>): string {
  if (node.parentId && containerIds.has(node.parentId)) {
    return node.parentId;
  }
  return "1";
}

function exportDepth(
  id: string,
  byId: Map<string, ExportNode>,
  containerIds: Set<string>,
  memo: Map<string, number>,
): number {
  if (memo.has(id)) return memo.get(id)!;
  const node = byId.get(id);
  if (!node) {
    memo.set(id, 0);
    return 0;
  }
  const parent = drawParentId(node, containerIds);
  if (parent === "1") {
    memo.set(id, 0);
    return 0;
  }
  const d = 1 + exportDepth(parent, byId, containerIds, memo);
  memo.set(id, d);
  return d;
}

/** Parents before children (containers must exist first), then top-to-bottom, left-to-right. */
function sortExportOrder(nodes: ExportNode[], containerIds: Set<string>): ExportNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const memo = new Map<string, number>();
  return [...nodes].sort((a, b) => {
    const da = exportDepth(a.id, byId, containerIds, memo);
    const db = exportDepth(b.id, byId, containerIds, memo);
    if (da !== db) return da - db;
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });
}

function transformCanvasPoint(x: number, y: number, bbox: BoundingBox): { x: number; y: number } {
  return {
    x: Math.round(x - bbox.minX + DRAWIO_MIN_MARGIN),
    y: Math.round(y - bbox.minY + DRAWIO_MIN_MARGIN),
  };
}

/**
 * Turn a neutral `ExportModel` into mxGraph XML.
 *
 * Positions map 1:1: root nodes are shifted into positive space by the
 * bounding-box origin + margin (no scale factor), and container children keep
 * their parent-relative coordinates — preserving the gap-to-node ratio of the
 * source diagram.
 */
export function buildMxGraphXml(model: ExportModel, opts: { wrapper: MxGraphWrapper }): string {
  const { nodes, edges } = model;
  const containerIds = getContainerIds(nodes);
  const bbox = computeBoundingBox(nodes, containerIds);

  const exportedWidth = Math.ceil(bbox.width + DRAWIO_MIN_MARGIN * 2);
  const exportedHeight = Math.ceil(bbox.height + DRAWIO_MIN_MARGIN * 2);
  const pageWidth = Math.max(exportedWidth, CONFIG.grid.pageWidth);
  const pageHeight = Math.max(exportedHeight, CONFIG.grid.pageHeight);

  const ordered = sortExportOrder(nodes, containerIds);

  const vertexCells = ordered.map((node) => {
    const parentMx = drawParentId(node, containerIds);
    const isChildNode = !!(node.parentId && containerIds.has(node.parentId));
    const geometry = isChildNode
      ? { x: node.x, y: node.y, width: node.width, height: node.height }
      : {
          x: node.x - bbox.minX + DRAWIO_MIN_MARGIN,
          y: node.y - bbox.minY + DRAWIO_MIN_MARGIN,
          width: node.width,
          height: node.height,
        };
    return buildCell(node, geometry, parentMx);
  });

  const edgeCells = edges.map((edge) => {
    const waypoints =
      edge.waypoints && edge.waypoints.length > 0
        ? edge.waypoints.map((point) => transformCanvasPoint(point.x, point.y, bbox))
        : [];
    return buildEdgeCell(edge, { waypoints });
  });

  const allCells = [
    `<mxCell id="0"/>`,
    `<mxCell id="1" parent="0"/>`,
    ...vertexCells,
    ...edgeCells,
  ].join("");

  const mxGraphModel =
    `<mxGraphModel dx="${CONFIG.grid.dx}" dy="${CONFIG.grid.dy}" grid="1" gridSize="${CONFIG.grid.gridSize}" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="0" fit="1" pageScale="1" pageWidth="${pageWidth}" pageHeight="${pageHeight}" math="0" shadow="0" background="#ffffff">` +
    `<root>${allCells}</root>` +
    `</mxGraphModel>`;

  if (opts.wrapper === "mxgraphModel") {
    return mxGraphModel;
  }

  const slug = escXml(model.name);
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<mxfile><diagram name="${slug}">` +
    mxGraphModel +
    `</diagram></mxfile>`
  );
}
