/**
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 * Verbatim copy of the host export core (src/lib/export-core), synced via
 * `npm run sync-shared`. It is the single source of truth for draw.io
 * generation shared by the app and this plugin; edit the host files and re-sync.
 */

import { buildCell } from "./cell-builders";
import { CONFIG } from "./constants";
import { buildEdgeCell } from "./edge-builder";
import {
  type BoundingBox,
  computeBoundingBox,
  computeCompensationOffsets,
  compensatedMaxY,
  DRAWIO_MIN_MARGIN,
  getContainerIds,
} from "./geometry";
import type { ExportDecorations, ExportModel, ExportNode } from "./model";
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
 * Carries `structura*` attributes on the node's cell: added to its `<object>`
 * when it is one, else the cell is promoted to one — draw.io keeps the id and
 * the label on the object and the rest on the `<mxCell>` inside it. Cells
 * that follow (representations) are left as they are.
 */
export function withMetadata(
  xml: string,
  metadata: Readonly<Record<string, string>> | undefined,
): string {
  if (!metadata || Object.keys(metadata).length === 0) return xml;
  const attributes = Object.entries(metadata)
    .map(([key, value]) => `${key}="${escXml(value)}"`)
    .join(" ");
  if (xml.startsWith("<object ")) return `<object ${attributes} ${xml.slice("<object ".length)}`;
  const head = /^<mxCell id="([^"]*)" value="([^"]*)" /.exec(xml);
  const end = xml.indexOf("</mxCell>");
  if (!head || end === -1) return xml;
  const cell = xml.slice(head[0].length, end + "</mxCell>".length);
  return (
    `<object id="${head[1]}" label="${head[2]}" ${attributes}><mxCell ${cell}</object>` +
    xml.slice(end + "</mxCell>".length)
  );
}

/** A node's badges, under it, as plain cells no edge can reach. */
function badgeCells(node: ExportNode, height: number): string {
  let x = 0;
  return (node.badges ?? [])
    .map((badge) => {
      const width = 12 + badge.label.length * 6;
      const cell =
        `<mxCell id="${escXml(badge.id)}" value="${escXml(badge.label)}" ` +
        `style="rounded=1;arcSize=20;absoluteArcSize=1;html=1;fontSize=10;fontFamily=monospace;` +
        `connectable=0;movable=0;resizable=0;structuraBadge=1;fillColor=${badge.accentColor};fillOpacity=10;` +
        `strokeColor=${badge.accentColor};" vertex="1" parent="${escXml(node.id)}">` +
        `<mxGeometry x="${x}" y="${(height || 0) + 4}" width="${width}" height="16" as="geometry"/>` +
        `</mxCell>`;
      x += width + 4;
      return cell;
    })
    .join("");
}

const DECORATION_LAYER_ID = "structura-decorations";

/** The bounding box grown to hold the decorations, so they land in positive space too. */
function withDecorations(
  bbox: BoundingBox,
  decorations: ExportDecorations | undefined,
): BoundingBox {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const r of decorations?.rects ?? []) {
    xs.push(r.x, r.x + r.width);
    ys.push(r.y, r.y + r.height);
  }
  for (const l of decorations?.lines ?? []) {
    for (const p of l.points) {
      xs.push(p.x);
      ys.push(p.y);
    }
  }
  if (xs.length === 0) return bbox;
  const empty = bbox.width === 0 && bbox.height === 0 && bbox.minX === 0 && bbox.minY === 0;
  const minX = Math.min(...xs, ...(empty ? [] : [bbox.minX]));
  const minY = Math.min(...ys, ...(empty ? [] : [bbox.minY]));
  const maxX = Math.max(...xs, ...(empty ? [] : [bbox.maxX]));
  const maxY = Math.max(...ys, ...(empty ? [] : [bbox.maxY]));
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/** The decorations as a locked layer: plain shapes and open lines, never elements. */
function decorationCells(decorations: ExportDecorations | undefined, bbox: BoundingBox): string {
  if (!decorations || (decorations.rects.length === 0 && decorations.lines.length === 0)) return "";
  const layer = `<mxCell id="${DECORATION_LAYER_ID}" value="${escXml(decorations.layerName)}" style="locked=1;" parent="0"/>`;
  const rects = decorations.rects.map((r) => {
    const at = transformCanvasPoint(r.x, r.y, bbox);
    return (
      `<mxCell id="${escXml(r.id)}" value="${escXml(r.label)}" ` +
      `style="rounded=1;whiteSpace=wrap;html=1;fontSize=11;fontStyle=1;fillColor=#f8fafc;` +
      `strokeColor=#cbd5e1;fontColor=#475569;structuraDecoration=1;" vertex="1" parent="${DECORATION_LAYER_ID}">` +
      `<mxGeometry x="${at.x}" y="${at.y}" width="${Math.round(r.width)}" height="${Math.round(r.height)}" as="geometry"/>` +
      `</mxCell>`
    );
  });
  const lines = decorations.lines.flatMap((l) => {
    if (l.points.length < 2) return [];
    const points = l.points.map((p) => transformCanvasPoint(p.x, p.y, bbox));
    const first = points[0]!;
    const last = points[points.length - 1]!;
    const middle = points.slice(1, -1);
    return [
      `<mxCell id="${escXml(l.id)}" value="" ` +
        `style="endArrow=none;startArrow=none;html=1;rounded=0;strokeColor=#94a3b8;` +
        `${l.dashed ? "dashed=1;strokeWidth=1;" : "strokeWidth=2;"}structuraDecoration=1;" edge="1" parent="${DECORATION_LAYER_ID}">` +
        `<mxGeometry relative="1" as="geometry">` +
        `<mxPoint x="${first.x}" y="${first.y}" as="sourcePoint"/>` +
        `<mxPoint x="${last.x}" y="${last.y}" as="targetPoint"/>` +
        (middle.length > 0
          ? `<Array as="points">${middle.map((p) => `<mxPoint x="${p.x}" y="${p.y}"/>`).join("")}</Array>`
          : "") +
        `</mxGeometry></mxCell>`,
    ];
  });
  return layer + rects.join("") + lines.join("");
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
  const bbox = withDecorations(computeBoundingBox(nodes, containerIds), model.decorations);

  const ordered = sortExportOrder(nodes, containerIds);

  // Propagate canonical C4_META sizes by pushing overlapping nodes apart in Y.
  const compensationOffsets = computeCompensationOffsets(ordered, containerIds);

  const exportedWidth = Math.ceil(bbox.width + DRAWIO_MIN_MARGIN * 2);
  const compensatedBottom = compensatedMaxY(ordered, compensationOffsets);
  // Compensated nodes may extend below what the original bbox captured (which was
  // computed before compensation), so pageHeight must accommodate the deepest node.
  const exportedHeight = Math.ceil(
    Math.max(
      compensatedBottom - bbox.minY + DRAWIO_MIN_MARGIN,
      bbox.height + DRAWIO_MIN_MARGIN * 2,
    ),
  );
  const pageWidth = Math.max(exportedWidth, CONFIG.grid.pageWidth);
  const pageHeight = Math.max(exportedHeight, CONFIG.grid.pageHeight);

  const vertexCells = ordered.map((node) => {
    const parentMx = drawParentId(node, containerIds);
    const isChildNode = !!(node.parentId && containerIds.has(node.parentId));
    const offsetY = compensationOffsets.get(node.id) ?? 0;
    const geometry = isChildNode
      ? { x: node.x, y: node.y + offsetY, width: node.width, height: node.height }
      : {
          x: node.x - bbox.minX + DRAWIO_MIN_MARGIN,
          y: node.y - bbox.minY + DRAWIO_MIN_MARGIN + offsetY,
          width: node.width,
          height: node.height,
        };
    return (
      withMetadata(buildCell(node, geometry, parentMx), node.metadata) +
      badgeCells(node, geometry.height)
    );
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
    decorationCells(model.decorations, bbox),
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
