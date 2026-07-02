import { EdgeStyle } from "@/features/diagram";
import { METHOD_COLORS, PROTOCOL_COLORS } from "@/features/canvas/nodes/ApiGroupNode/constants";
import { BOX_POINTS, C4_SHAPE_POINTS } from "./constants";
import type { AwsServiceInfo, C4MetaInfo } from "./types";
import { buildStyle, escXml } from "./xml-utils";

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

export function buildAwsStyle(awsInfo: AwsServiceInfo): string {
  const baseStyle = `sketch=0;outlineConnect=0;dashed=0;verticalLabelPosition=middle;verticalAlign=bottom;align=center;html=1;whiteSpace=wrap;fontSize=10;fontStyle=1;spacing=3;shape=mxgraph.aws4.productIcon;prIcon=mxgraph.aws4.${awsInfo.icon};`;

  return buildStyle(baseStyle, {
    strokeColor: "#ffffff",
    fillColor: "#232F3E",
    fontColor: "#232F3E",
    gradientColor: "none",
  });
}

export function buildPanelStyle(stroke: string): string {
  const baseStyle = `rounded=1;arcSize=20;dashed=1;dashPattern=8 4;fillColor=none;whiteSpace=wrap;html=1;fontSize=11;labelBackgroundColor=none;align=left;verticalAlign=bottom;spacing=10;spacingTop=0;metaEdit=1;rotatable=0;connectable=0;allowArrows=0;expand=0;recursiveResize=0;editable=1;pointerEvents=0;absoluteArcSize=1;perimeter=rectanglePerimeter;`;

  return buildStyle(baseStyle, {
    strokeColor: stroke,
    fontColor: "#333333",
    points:
      "[[0.25,0,0],[0.5,0,0],[0.75,0,0],[1,0.25,0],[1,0.5,0],[1,0.75,0],[0.75,1,0],[0.5,1,0],[0.25,1,0],[0,0.75,0],[0,0.5,0],[0,0.25,0]]",
  });
}

export function buildNoteStyle(): string {
  return "text;html=1;strokeColor=#cccccc;fillColor=#ffffff;align=left;verticalAlign=top;spacingLeft=8;spacingTop=6;whiteSpace=wrap;rounded=1;arcSize=5;fontColor=#000000;fontSize=12;";
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

function resolveDrawioEdgeStyle(edgeStyle: EdgeStyle | undefined, isDashed = false): string {
  const curvedSuffix = isDashed ? "" : "curved=1;";

  switch (edgeStyle) {
    case EdgeStyle.Straight:
      return "edgeStyle=none;html=1;";
    case EdgeStyle.Step:
      return "edgeStyle=orthogonalEdgeStyle;orthogonalLoop=1;jettySize=auto;html=1;";
    case EdgeStyle.Bezier:
      return "edgeStyle=entityRelationEdgeStyle;html=1;";
    case EdgeStyle.Smoothstep:
    default:
      return `edgeStyle=elbowEdgeStyle;elbow=orthogonal;${curvedSuffix}rounded=1;orthogonalLoop=1;jettySize=auto;html=1;`;
  }
}

export function buildEdgeStyle(
  strokeColor: string,
  isDashed: boolean,
  dashPattern: string,
  strokeWidth: number,
  endArrow: string,
  startArrow: string,
  edgeStyle?: EdgeStyle,
): string {
  const baseStyle = resolveDrawioEdgeStyle(edgeStyle, isDashed);

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
