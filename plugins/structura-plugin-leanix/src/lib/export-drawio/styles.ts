import { BOX_POINTS, C4_SHAPE_POINTS } from "./constants";
import type { AwsServiceInfo, C4MetaInfo } from "./types";
import { buildStyle, escXml } from "./xml-utils";

/**
 * Build the second line of C4 label (description + technology)
 */
export function buildC4Line2(description?: string, technology?: string): string {
  const parts: string[] = [];
  if (description) parts.push(description);
  if (technology) parts.push(`[${technology}]`);
  return parts.join(" ");
}

/**
 * Get human-readable C4 type label
 */
export function c4TypeLabel(type: string): string {
  const typeMap: Record<string, string> = {
    person: "Person",
    system: "Software System",
    container: "Container",
    component: "Component",
  };
  return typeMap[type] || type;
}

/**
 * Build registry badge HTML for service catalog
 */
export function buildC4RegistryBadge(serviceName?: string): string {
  if (!serviceName) return "";
  return `<div><font style="font-size:9px;color:#666666">⬡ ${escXml(serviceName)}</font></div>`;
}

/**
 * Build draw.io style for C4 components
 */
export function buildC4Style(meta: C4MetaInfo, type: string): string {
  const baseStyle = `html=1;whiteSpace=wrap;fontSize=11;align=center;dashed=0;metaEdit=1;resizable=0;${C4_SHAPE_POINTS[type] ?? BOX_POINTS}`;

  return buildStyle(baseStyle, {
    fillColor: meta.fillColor,
    strokeColor: meta.strokeColor,
    fontColor: meta.fontColor,
    labelBackgroundColor: "none",
  });
}

/**
 * Build draw.io style for AWS components
 */
export function buildAwsStyle(awsInfo: AwsServiceInfo): string {
  const baseStyle = `sketch=0;outlineConnect=0;dashed=0;verticalLabelPosition=middle;verticalAlign=bottom;align=center;html=1;whiteSpace=wrap;fontSize=10;fontStyle=1;spacing=3;shape=mxgraph.aws4.productIcon;prIcon=mxgraph.aws4.${awsInfo.icon};`;

  return buildStyle(baseStyle, {
    strokeColor: "#ffffff",
    fillColor: "#232F3E",
    fontColor: "#232F3E",
    gradientColor: "none",
  });
}

/**
 * Build draw.io style for panels (system boundaries)
 */
export function buildPanelStyle(stroke: string): string {
  const baseStyle = `rounded=1;arcSize=20;dashed=1;dashPattern=8 4;fillColor=none;whiteSpace=wrap;html=1;fontSize=11;labelBackgroundColor=none;align=left;verticalAlign=bottom;spacing=10;spacingTop=0;metaEdit=1;rotatable=0;connectable=0;allowArrows=0;expand=0;recursiveResize=0;editable=1;pointerEvents=0;absoluteArcSize=1;perimeter=rectanglePerimeter;`;

  return buildStyle(baseStyle, {
    strokeColor: stroke,
    fontColor: "#333333",
    points:
      "[[0.25,0,0],[0.5,0,0],[0.75,0,0],[1,0.25,0],[1,0.5,0],[1,0.75,0],[0.75,1,0],[0.5,1,0],[0.25,1,0],[0,0.75,0],[0,0.5,0],[0,0.25,0]]",
  });
}

/**
 * Build draw.io style for notes
 */
export function buildNoteStyle(): string {
  return "text;html=1;strokeColor=#cccccc;fillColor=#ffffff;align=left;verticalAlign=top;spacingLeft=8;spacingTop=6;whiteSpace=wrap;rounded=1;arcSize=5;fontColor=#000000;fontSize=12;";
}

/**
 * Build draw.io style for API groups
 */
export function buildApiGroupStyle(protocol: string): string {
  const stroke = getProtocolColor(protocol);
  const baseStyle =
    "rounded=1;whiteSpace=wrap;html=1;align=left;verticalAlign=top;spacingLeft=10;spacingTop=8;fontSize=11;fontStyle=1;fillColor=#f8fafc;";
  return buildStyle(baseStyle, {
    strokeColor: stroke,
    fontColor: "#0f172a",
  });
}

/**
 * Build draw.io style for endpoints
 */
export function buildEndpointStyle(method: string): string {
  const accent = getMethodColor(method);
  const baseStyle =
    "rounded=1;whiteSpace=wrap;html=1;align=left;verticalAlign=middle;spacingLeft=8;spacingRight=8;fontSize=11;strokeColor=#e2e8f0;fillColor=#ffffff;";
  return buildStyle(baseStyle, {
    fontColor: accent,
  });
}

/**
 * Get color for HTTP method
 */
function getMethodColor(method: string): string {
  const colors: Record<string, string> = {
    GET: "#059669",
    POST: "#2563eb",
    PUT: "#d97706",
    PATCH: "#7c3aed",
    DELETE: "#dc2626",
    HEAD: "#0891b2",
    OPTIONS: "#6366f1",
  };
  return colors[method.toUpperCase()] ?? "#64748b";
}

/**
 * Get color for protocol
 */
function getProtocolColor(protocol: string): string {
  const colors: Record<string, string> = {
    http: "#ef4444",
    https: "#22c55e",
    rest: "#3b82f6",
    graphql: "#e535ab",
    websocket: "#f59e0b",
    grpc: "#0ea5e9",
  };
  return colors[protocol.toLowerCase()] ?? "#6366f1";
}

/**
 * Edge style types (simplified for plugin)
 */
export enum EdgeStyle {
  Straight = "straight",
  Step = "step",
  Bezier = "bezier",
  Smoothstep = "smoothstep",
}

/**
 * Build draw.io style for edges (connections)
 */
export function buildEdgeStyle(
  strokeColor: string,
  endArrow: string = "block",
  startArrow: string = "none",
): string {
  const baseStyle = "edgeStyle=elbowEdgeStyle;elbow=orthogonal;curved=1;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;";

  return buildStyle(baseStyle, {
    endArrow,
    endFill: endArrow === "block" ? 1 : 0,
    ...(startArrow !== "none" && {
      startArrow,
      startFill: startArrow === "block" ? 1 : 0,
    }),
    strokeColor,
    fontColor: "#000000",
    fontSize: 11,
    labelBackgroundColor: "#ffffff",
    labelBorderColor: "none",
  });
}
