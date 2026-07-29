import { BOX_POINTS, C4_SHAPE_POINTS, METHOD_COLORS, PROTOCOL_COLORS } from "./constants";
import type { ExportEdgeStyle } from "./model";
import type { C4MetaInfo } from "./types";
import { buildStyle, escXml } from "./xml-utils";
import { mixWithWhite, toHex } from "./color-utils";

export function buildC4Line2(description?: string, technology?: string): string {
  const parts: string[] = [];
  if (description) parts.push(description);
  if (technology) parts.push(`[${technology}]`);
  return parts.join(" ");
}

export function c4TypeLabel(type: string): string {
  const typeMap: Record<string, string> = {
    person: "Person",
    system: "Software System",
    container: "Container",
    component: "Component",
  };
  return typeMap[type] || type;
}

export function buildC4RegistryBadge(serviceName?: string): string {
  if (!serviceName) return "";
  return `<div><font style="font-size:9px;color:#666666">⬡ ${escXml(serviceName)}</font></div>`;
}

export function buildC4Style(meta: C4MetaInfo, type: string): string {
  const baseStyle = `html=1;whiteSpace=wrap;fontSize=11;align=center;dashed=0;metaEdit=1;resizable=0;${C4_SHAPE_POINTS[type] ?? BOX_POINTS}`;

  return buildStyle(baseStyle, {
    fillColor: meta.fillColor,
    strokeColor: meta.strokeColor,
    fontColor: meta.fontColor,
    labelBackgroundColor: "none",
  });
}

export function buildAwsStyle(icon: string): string {
  const baseStyle = `sketch=0;outlineConnect=0;dashed=0;verticalLabelPosition=middle;verticalAlign=bottom;align=center;html=1;whiteSpace=wrap;fontSize=10;fontStyle=1;spacing=3;shape=mxgraph.aws4.productIcon;prIcon=mxgraph.aws4.${icon};`;

  return buildStyle(baseStyle, {
    strokeColor: "#ffffff",
    fillColor: "#232F3E",
    fontColor: "#232F3E",
    gradientColor: "none",
  });
}

/**
 * Build the drawio style for a Structura panel container.
 *
 * The canvas renders panels with a translucent fill (`color` mixed with the
 * background by `panelOpacity/100`) and a coloured border. drawio's `fillColor`
 * only accepts a hex string with no alpha, so we mimic the canvas's look by
 * pre-tinting the fill toward white and then applying `fillOpacity` — together
 * they read as a soft tinted background, close to what the React Flow renderer
 * shows.
 *
 * NB: drawio's `fillOpacity` is an integer 0–100 (a percentage), not a 0–1
 * fraction — older desktop builds silently ignore fractional values, which is
 * why we previously saw every panel export as effectively transparent. Always
 * pass an integer here.
 */
export function buildPanelStyle(options: {
  /** Raw panel colour from the snapshot (hex or hsl). */
  color: string;
  /** Background tint 0–100 (Structura canvas semantics). */
  opacity: number;
  /** Border style from the snapshot. */
  borderStyle: "solid" | "dashed" | "dotted";
}): string {
  const strokeHex = toHex(options.color);
  // Translucent canvas fill = color at `opacity/100` over white.
  // drawio can't blend on its own, so we approximate by mixing toward white by
  // (1 - opacity) and then letting fillOpacity carry the remaining transparency.
  const opacityClamped = Math.max(0, Math.min(100, options.opacity));
  const tintAmount = 1 - opacityClamped / 100;
  const fillHex = mixWithWhite(strokeHex, tintAmount);
  const fillOpacityPct = Math.round(Math.max(0, Math.min(1, opacityClamped / 100 + 0.08)) * 100);

  const baseStyle = `rounded=1;arcSize=20;whiteSpace=wrap;html=1;fontSize=11;labelBackgroundColor=none;align=left;verticalAlign=top;spacing=10;spacingTop=0;metaEdit=1;rotatable=0;connectable=0;allowArrows=0;expand=0;recursiveResize=0;editable=1;pointerEvents=0;absoluteArcSize=1;perimeter=rectanglePerimeter;strokeWidth=2;`;

  const dashBits =
    options.borderStyle === "dashed"
      ? "dashed=1;dashPattern=8 4;"
      : options.borderStyle === "dotted"
        ? "dashed=1;dashPattern=1 4;"
        : "";

  return buildStyle(baseStyle + dashBits, {
    strokeColor: strokeHex,
    fillColor: fillHex,
    fillOpacity: fillOpacityPct,
    fontColor: "#333333",
    points:
      "[[0.25,0,0],[0.5,0,0],[0.75,0,0],[1,0.25,0],[1,0.5,0],[1,0.75,0],[0.75,1,0],[0.5,1,0],[0.25,1,0],[0,0.75,0],[0,0.5,0],[0,0.25,0]]",
  });
}

export function buildNoteStyle(): string {
  return "text;html=1;strokeColor=#cccccc;fillColor=#ffffff;align=left;verticalAlign=top;spacingLeft=8;spacingTop=6;whiteSpace=wrap;rounded=1;arcSize=5;fontColor=#000000;fontSize=12;";
}

/**
 * Build the drawio style for a Structura swimlane.
 *
 * drawio's `swimlane` shape (a.k.a. "Horizontal Container" / "Vertical
 * Container" in the drawio palette) uses `horizontal=0|1` to pick the
 * orientation and has TWO independent fills:
 *   - `fillColor`           → the lane body (content area)
 *   - `swimlaneFillColor`   → the colored stripe (`startSize` wide) that
 *                             carries the lane label
 *
 * Structura's `panelOpacity` controls how strongly the lane colour paints
 * both surfaces, so we apply the same opacity to both. This matches what the
 * canvas renderer does — there the same `laneColor` + `opacity` drive both
 * the body tint and the stripe colour.
 */
export function buildSwimlaneStyle(options: {
  laneColor: string;
  orientation: "horizontal" | "vertical";
  /** Background tint 0–100. */
  opacity: number;
}): string {
  const strokeHex = toHex(options.laneColor);
  const opacityClamped = Math.max(0, Math.min(100, options.opacity));
  const tintAmount = 1 - opacityClamped / 100;
  const fillHex = mixWithWhite(strokeHex, tintAmount);
  const fillOpacityPct = Math.round(
    Math.max(0, Math.min(1, opacityClamped / 100 + 0.08)) * 100,
  );
  // The stripe carries the lane colour at its real saturation. We still pass
  // `swimlaneFillOpacity` so users who want a softer stripe can dial opacity
  // down without losing the lane identity (the body fillOpacity carries the
  // tint amount too).
  const horizontal = options.orientation === "vertical" ? 1 : 0;

  const baseStyle = `swimlane;horizontal=${horizontal};whiteSpace=wrap;html=1;startSize=24;`;

  return buildStyle(baseStyle, {
    strokeColor: strokeHex,
    fillColor: fillHex,
    fillOpacity: fillOpacityPct,
    // Stripe colours + opacity — both must be present, otherwise drawio falls
    // back to the default orange/red stripe and the lane loses its identity.
    swimlaneFillColor: strokeHex,
    swimlaneFillOpacity: fillOpacityPct,
    fontColor: "#333333",
  });
}

export function buildApiGroupStyle(protocol: string): string {
  const stroke = PROTOCOL_COLORS[protocol as keyof typeof PROTOCOL_COLORS] ?? "#6366f1";
  const baseStyle =
    "rounded=1;whiteSpace=wrap;html=1;align=left;verticalAlign=top;spacingLeft=10;spacingTop=8;fontSize=11;fontStyle=1;fillColor=#f8fafc;";
  return buildStyle(baseStyle, {
    strokeColor: stroke,
    fontColor: "#0f172a",
  });
}

export function buildEndpointStyle(method: string): string {
  const accent = METHOD_COLORS[method as keyof typeof METHOD_COLORS] ?? "#64748b";
  const baseStyle =
    "rounded=1;whiteSpace=wrap;html=1;align=left;verticalAlign=middle;spacingLeft=8;spacingRight=8;fontSize=11;strokeColor=#e2e8f0;fillColor=#ffffff;";
  return buildStyle(baseStyle, {
    fontColor: accent,
  });
}

function resolveDrawioEdgeStyle(edgeStyle: ExportEdgeStyle): string {
  switch (edgeStyle) {
    case "straight":
      return "edgeStyle=none;html=1;";
    case "step":
      return "edgeStyle=orthogonalEdgeStyle;orthogonalLoop=1;jettySize=auto;html=1;";
    case "bezier":
      return "edgeStyle=entityRelationEdgeStyle;html=1;";
    case "smoothstep":
    case "editable":
    case "editable-step":
    default:
      // Orthogonal routing with rounded corners — mirrors React Flow's smoothstep
      // (right-angle segments) and supports multi-bend routes (e.g. when the
      // target is below and to the left of the source, requiring two bends).
      // elbowEdgeStyle (the previous default) only handled one bend cleanly.
      return "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;";
  }
}

export function buildEdgeStyle(
  strokeColor: string,
  isDashed: boolean,
  dashPattern: string,
  strokeWidth: number,
  endArrow: string,
  startArrow: string,
  edgeStyle: ExportEdgeStyle,
): string {
  const baseStyle = resolveDrawioEdgeStyle(edgeStyle);

  return buildStyle(baseStyle, {
    endArrow,
    endFill: endArrow === "block" ? 1 : 0,
    ...(startArrow !== "none" && {
      startArrow,
      startFill: startArrow === "block" ? 1 : 0,
    }),
    ...(isDashed && { dashed: 1, dashPattern, rounded: 0 }),
    ...(strokeWidth !== 1 && { strokeWidth }),
    strokeColor,
    fontColor: "#000000",
    fontSize: 11,
    labelBackgroundColor: "#ffffff",
    labelBorderColor: "none",
  });
}
