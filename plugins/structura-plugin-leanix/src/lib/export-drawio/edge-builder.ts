import type { PluginConnectionSnapshot } from "../../types/plugin";
import { THEME } from "./constants";
import { buildEdgeStyle } from "./styles";
import { escXml } from "./xml-utils";

/**
 * Build edge label with optional technology
 */
export function buildEdgeLabelPlain(conn: PluginConnectionSnapshot): string {
  const rawLabel = (conn.label ?? "").trim();
  const rawTech = (conn.technology ?? "").trim();
  if (rawTech) {
    return rawLabel ? `${rawLabel}\n(${rawTech})` : `(${rawTech})`;
  }
  return rawLabel;
}

/**
 * Build a draw.io edge cell for a connection
 */
export function buildEdgeCell(conn: PluginConnectionSnapshot): string {
  const strokeColor = getStrokeColorByIntent(conn);
  const style = buildEdgeStyle(strokeColor, "block", "none");

  const value = escXml(buildEdgeLabelPlain(conn));

  return (
    `<mxCell id="${escXml(conn.id)}" value="${value}" style="${style}" ` +
    `edge="1" source="${escXml(conn.sourceId)}" target="${escXml(conn.targetId)}" parent="1">` +
    `<mxGeometry relative="1" as="geometry"/>` +
    `</mxCell>`
  );
}

/**
 * Get stroke color based on connection intent/description
 */
function getStrokeColorByIntent(conn: PluginConnectionSnapshot): string {
  // Try to infer intent from description or technology
  const desc = (conn.description ?? "").toLowerCase();
  const tech = (conn.technology ?? "").toLowerCase();
  const label = conn.label.toLowerCase();

  if (desc.includes("sync") || tech.includes("sync") || label.includes("call")) {
    return THEME.strokes.call;
  }
  if (desc.includes("event") || tech.includes("event") || label.includes("event")) {
    return THEME.strokes.event;
  }
  if (desc.includes("data") || tech.includes("data") || label.includes("data")) {
    return THEME.strokes.dataFlow;
  }
  if (desc.includes("async") || tech.includes("async") || label.includes("async")) {
    return THEME.strokes.asyncMessage;
  }
  if (desc.includes("depend") || tech.includes("depend")) {
    return THEME.strokes.dependency;
  }

  return THEME.strokes.default;
}
