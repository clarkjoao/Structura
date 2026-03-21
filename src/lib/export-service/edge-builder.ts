import {
  getEffectiveConnectionStyle,
  StrokeStyle,
  EdgeMarker,
} from "@/features/diagram";
import type { Connection } from "@/features/diagram";
import { THEME } from "./constants";
import { buildEdgeStyle } from "./styles";
import { escXml } from "./xml-utils";

export function buildEdgeCell(conn: Connection): string {
  const eff = getEffectiveConnectionStyle(conn);
  const isDashed =
    eff.strokeStyle === StrokeStyle.Dashed || eff.strokeStyle === StrokeStyle.Dotted;
  const dashPattern = eff.strokeStyle === StrokeStyle.Dotted ? "2 4" : "8 4";

  function toDrawioArrow(m: string): string {
    if (m === EdgeMarker.ArrowClosed) return "block";
    if (m === EdgeMarker.Arrow) return "open";
    return "none";
  }

  const endArrow = toDrawioArrow(eff.markerEnd);
  const startArrow = toDrawioArrow(eff.markerStart);
  const bidir =
    eff.markerStart !== EdgeMarker.None
      ? `startArrow=${startArrow};startFill=${startArrow === "block" ? 1 : 0};`
      : "";

  const strokeColor = getStrokeColor(conn.intent);
  const strokeWidth = eff.strokeWidth ?? 1;

  const style = buildEdgeStyle(
    strokeColor,
    isDashed,
    dashPattern,
    strokeWidth,
    endArrow,
    startArrow,
    bidir,
  );

  const tech = conn.technology
    ? `<div><i>${escXml(conn.technology)}</i></div>`
    : "";
  const value = conn.label ? `${escXml(conn.label)}${tech}` : tech;

  return (
    `<mxCell id="${escXml(conn.id)}" value="${value}" style="${style}" ` +
    `edge="1" source="${escXml(conn.sourceId)}" target="${escXml(conn.targetId)}" parent="1">` +
    `<mxGeometry relative="1" as="geometry"/>` +
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

  return colorMap[intent] ?? THEME.strokes.default;
}
