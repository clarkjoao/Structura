import { THEME } from "./constants";
import type { ExportEdge, ExportMarker } from "./model";
import { buildEdgeStyle } from "./styles";
import { escXml } from "./xml-utils";

export function buildEdgeLabelPlain(edge: ExportEdge): string {
  const rawLabel = (edge.label ?? "").trim();
  const rawTech = (edge.technology ?? "").trim();
  if (rawTech) {
    return rawLabel ? `${rawLabel}\n(${rawTech})` : `(${rawTech})`;
  }
  return rawLabel;
}

export interface BuildEdgeCellOptions {
  waypoints?: { x: number; y: number }[];
}

function toDrawioArrow(m: ExportMarker): string {
  if (m === "arrow-closed") return "block";
  if (m === "arrow") return "open";
  return "none";
}

function getStrokeColor(intent: string | undefined): string {
  const colorMap: Record<string, string> = {
    call: THEME.strokes.call,
    event: THEME.strokes.event,
    "data-flow": THEME.strokes.dataFlow,
    "async-message": THEME.strokes.asyncMessage,
    dependency: THEME.strokes.dependency,
  };

  return (intent ? colorMap[intent] : undefined) ?? THEME.strokes.default;
}

export function buildEdgeCell(edge: ExportEdge, options?: BuildEdgeCellOptions): string {
  const isDashed = edge.strokeStyle === "dashed" || edge.strokeStyle === "dotted";
  const dashPattern = edge.strokeStyle === "dotted" ? "2 4" : "8 4";

  const endArrow = toDrawioArrow(edge.markerEnd);
  const startArrow = toDrawioArrow(edge.markerStart);
  const hasStartArrow = edge.markerStart !== "none";

  const strokeColor = getStrokeColor(edge.intent);
  const strokeWidth = edge.strokeWidth ?? 1;

  const style = buildEdgeStyle(
    strokeColor,
    isDashed,
    dashPattern,
    strokeWidth,
    endArrow,
    hasStartArrow ? startArrow : "none",
    edge.edgeStyle,
  );

  const value = escXml(buildEdgeLabelPlain(edge));

  const waypointsXml =
    options?.waypoints && options.waypoints.length > 0
      ? (() => {
          const points = options.waypoints
            .map((waypoint) => `<mxPoint x="${waypoint.x}" y="${waypoint.y}"/>`)
            .join("");
          return `<Array as="points">${points}</Array>`;
        })()
      : "";

  // Exit/entry anchors are now inferred from geometry in to-export-model.ts,
  // supporting all 4 sides (not just the hardcoded right/left assumption).
  const anchorAttrs =
    edge.exitX !== undefined || edge.entryX !== undefined
      ? ` exitX="${edge.exitX ?? 1}" exitY="${edge.exitY ?? 0.5}" entryX="${edge.entryX ?? 0}" entryY="${edge.entryY ?? 0.5}"`
      : "";

  return (
    `<mxCell id="${escXml(edge.id)}" value="${value}" style="${style}" ` +
    `edge="1" source="${escXml(edge.sourceId)}" target="${escXml(edge.targetId)}" parent="1">` +
    `<mxGeometry relative="1" as="geometry"${anchorAttrs}>${waypointsXml}</mxGeometry>` +
    `</mxCell>`
  );
}
