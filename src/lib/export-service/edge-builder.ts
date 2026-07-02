import {
  EdgeStyle,
  getEffectiveConnectionStyle,
  StrokeStyle,
  EdgeMarker,
} from "@/features/diagram";
import type { Connection } from "@/features/diagram";
import { THEME } from "./constants";
import { buildEdgeStyle } from "./styles";
import { escXml } from "./xml-utils";

export function buildEdgeLabelPlain(conn: Connection): string {
  const rawLabel = (conn.label ?? "").trim();
  const rawTech = (conn.technology ?? "").trim();
  if (rawTech) {
    return rawLabel ? `${rawLabel}\n(${rawTech})` : `(${rawTech})`;
  }
  return rawLabel;
}

export interface BuildEdgeCellOptions {
  waypoints?: { x: number; y: number }[];
}

export function buildEdgeCell(conn: Connection, options?: BuildEdgeCellOptions): string {
  const eff = getEffectiveConnectionStyle(conn);
  const isDashed = eff.strokeStyle === StrokeStyle.Dashed || eff.strokeStyle === StrokeStyle.Dotted;
  const dashPattern = eff.strokeStyle === StrokeStyle.Dotted ? "2 4" : "8 4";

  function toDrawioArrow(m: string): string {
    if (m === EdgeMarker.ArrowClosed) return "block";
    if (m === EdgeMarker.Arrow) return "open";
    return "none";
  }

  const endArrow = toDrawioArrow(eff.markerEnd);
  const startArrow = toDrawioArrow(eff.markerStart);
  const hasStartArrow = eff.markerStart !== EdgeMarker.None;

  const strokeColor = getStrokeColor(conn.intent);
  const strokeWidth = eff.strokeWidth ?? 1;

  const resolvedEdgeStyle = conn.style?.edgeStyle ?? EdgeStyle.Smoothstep;

  const style = buildEdgeStyle(
    strokeColor,
    isDashed,
    dashPattern,
    strokeWidth,
    endArrow,
    hasStartArrow ? startArrow : "none",
    resolvedEdgeStyle,
  );

  const value = escXml(buildEdgeLabelPlain(conn));

  const waypointsXml =
    options?.waypoints && options.waypoints.length > 0
      ? (() => {
          const points = options.waypoints
            .map((waypoint) => `<mxPoint x="${waypoint.x}" y="${waypoint.y}"/>`)
            .join("");
          return `<Array as="points">${points}</Array>`;
        })()
      : "";

  return (
    `<mxCell id="${escXml(conn.id)}" value="${value}" style="${style}" ` +
    `edge="1" source="${escXml(conn.sourceId)}" target="${escXml(conn.targetId)}" parent="1">` +
    `<mxGeometry relative="1" as="geometry">${waypointsXml}</mxGeometry>` +
    `</mxCell>`
  );
}

function getStrokeColor(intent: Connection["intent"]): string {
  const colorMap: Record<string, string> = {
    call: THEME.strokes.call,
    event: THEME.strokes.event,
    "data-flow": THEME.strokes.dataFlow,
    "async-message": THEME.strokes.asyncMessage,
    dependency: THEME.strokes.dependency,
  };

  return (intent ? colorMap[intent] : undefined) ?? THEME.strokes.default;
}
