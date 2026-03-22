import type { Component, Connection, Diagram, NodeLayout } from "@/features/diagram";
import {
  isApiGroupComponent,
  isAwsComponent,
  isC4Component,
  isEndpointComponent,
  isNoteComponent,
  isPanelComponent,
} from "@/features/diagram";
import {
  DEFAULT_NODE_H,
  DEFAULT_NODE_W,
  NOTE_DEFAULT_H,
  NOTE_DEFAULT_W,
  PANEL_COLLAPSED_H,
  PANEL_COLLAPSED_W,
  PANEL_DEFAULT_H,
  PANEL_DEFAULT_W,
} from "@/features/canvas/constants";

const MAX_ELEMENTS = 120;

const C4_PREVIEW_COLORS: Record<string, string> = {
  person: "hsl(38 92% 50%)",
  system: "hsl(187 72% 51%)",
  container: "hsl(260 60% 55%)",
  component: "hsl(152 60% 45%)",
};

const AWS_PREVIEW_FILL = "hsl(25 90% 52%)";
const API_GROUP_PREVIEW_FILL = "hsl(187 72% 51%)";
const DEFAULT_PANEL_FILL = "hsl(220 14% 90%)";
const NOTE_FALLBACK_FILL = "hsl(45 25% 97%)";
const CONNECTION_STROKE = "hsl(220 20% 40%)";

function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;")
    .replace(/>/g, "&gt;");
}

function defaultSize(component: Component, layout: NodeLayout): { width: number; height: number } {
  if (isPanelComponent(component)) {
    if (component.collapsed) {
      return {
        width: component.collapsedWidth ?? PANEL_COLLAPSED_W,
        height: component.collapsedHeight ?? PANEL_COLLAPSED_H,
      };
    }
    return {
      width: layout.width ?? PANEL_DEFAULT_W,
      height: layout.height ?? PANEL_DEFAULT_H,
    };
  }
  if (isNoteComponent(component)) {
    return {
      width: layout.width ?? NOTE_DEFAULT_W,
      height: layout.height ?? NOTE_DEFAULT_H,
    };
  }
  return {
    width: layout.width ?? DEFAULT_NODE_W,
    height: layout.height ?? DEFAULT_NODE_H,
  };
}

function getAbsoluteBounds(
  elementId: string,
  components: Record<string, Component>,
  layouts: Record<string, NodeLayout>,
  cache: Map<string, { x: number; y: number; width: number; height: number }>,
): { x: number; y: number; width: number; height: number } | null {
  const cached = cache.get(elementId);
  if (cached) return cached;

  const layout = layouts[elementId];
  const component = components[elementId];
  if (!layout || !component) return null;

  const { width, height } = defaultSize(component, layout);
  let x = layout.x;
  let y = layout.y;

  if (component.parentId) {
    const parentBounds = getAbsoluteBounds(component.parentId, components, layouts, cache);
    if (parentBounds) {
      x += parentBounds.x;
      y += parentBounds.y;
    }
  }

  const bounds = { x, y, width, height };
  cache.set(elementId, bounds);
  return bounds;
}

function centerOf(bounds: { x: number; y: number; width: number; height: number }): {
  cx: number;
  cy: number;
} {
  return { cx: bounds.x + bounds.width / 2, cy: bounds.y + bounds.height / 2 };
}

function renderConnectionLines(
  connections: Record<string, Connection>,
  boundsById: Map<string, { x: number; y: number; width: number; height: number }>,
): string[] {
  const lines: string[] = [];
  for (const connection of Object.values(connections)) {
    const sourceBounds = boundsById.get(connection.sourceId);
    const targetBounds = boundsById.get(connection.targetId);
    if (!sourceBounds || !targetBounds) continue;
    const sourceCenter = centerOf(sourceBounds);
    const targetCenter = centerOf(targetBounds);
    lines.push(
      `<line x1="${sourceCenter.cx.toFixed(1)}" y1="${sourceCenter.cy.toFixed(1)}" x2="${targetCenter.cx.toFixed(1)}" y2="${targetCenter.cy.toFixed(1)}" stroke="${CONNECTION_STROKE}" stroke-width="1" opacity="0.4"/>`,
    );
  }
  return lines;
}

function renderPanelShape(component: Component, bounds: { x: number; y: number; width: number; height: number }): string {
  if (!isPanelComponent(component)) return "";
  const fillBase = component.panelColor?.trim() || DEFAULT_PANEL_FILL;
  const fill = escapeXmlAttr(fillBase);
  const stroke = fill;
  const strokeDash =
    component.borderStyle === "dashed"
      ? ` stroke-dasharray="6 4"`
      : component.borderStyle === "dotted"
        ? ` stroke-dasharray="2 3"`
        : "";
  return `<rect x="${bounds.x.toFixed(1)}" y="${bounds.y.toFixed(1)}" width="${bounds.width.toFixed(1)}" height="${bounds.height.toFixed(1)}" rx="8" fill="${fill}" fill-opacity="0.15" stroke="${stroke}" stroke-opacity="0.4" stroke-width="1"${strokeDash}/>`;
}

function renderNoteShape(component: Component, bounds: { x: number; y: number; width: number; height: number }): string {
  if (!isNoteComponent(component)) return "";
  const fillBase = component.panelColor?.trim() || NOTE_FALLBACK_FILL;
  const fill = escapeXmlAttr(fillBase);
  return `<rect x="${bounds.x.toFixed(1)}" y="${bounds.y.toFixed(1)}" width="${bounds.width.toFixed(1)}" height="${bounds.height.toFixed(1)}" rx="4" fill="${fill}" fill-opacity="0.6"/>`;
}

function renderApiGroupShape(bounds: { x: number; y: number; width: number; height: number }): string {
  return `<rect x="${bounds.x.toFixed(1)}" y="${bounds.y.toFixed(1)}" width="${bounds.width.toFixed(1)}" height="${bounds.height.toFixed(1)}" rx="6" fill="${API_GROUP_PREVIEW_FILL}" fill-opacity="0.15"/>`;
}

function renderAwsShape(bounds: { x: number; y: number; width: number; height: number }): string {
  return `<rect x="${bounds.x.toFixed(1)}" y="${bounds.y.toFixed(1)}" width="${bounds.width.toFixed(1)}" height="${bounds.height.toFixed(1)}" rx="4" fill="${AWS_PREVIEW_FILL}" fill-opacity="0.2"/>`;
}

function renderPersonShape(bounds: { x: number; y: number; width: number; height: number }): string {
  const { cx, cy } = centerOf(bounds);
  const rx = bounds.width / 2;
  const ry = bounds.height / 2;
  const fill = C4_PREVIEW_COLORS.person;
  return `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${fill}" fill-opacity="0.6"/>`;
}

function renderC4Rect(
  type: string,
  bounds: { x: number; y: number; width: number; height: number },
): string {
  const fill = C4_PREVIEW_COLORS[type] ?? C4_PREVIEW_COLORS.component;
  return `<rect x="${bounds.x.toFixed(1)}" y="${bounds.y.toFixed(1)}" width="${bounds.width.toFixed(1)}" height="${bounds.height.toFixed(1)}" rx="6" fill="${fill}" fill-opacity="0.75"/>`;
}

function shapeForComponent(
  component: Component,
  bounds: { x: number; y: number; width: number; height: number },
  simplified: boolean,
): string {
  if (simplified && !isPanelComponent(component)) return "";

  if (isPanelComponent(component)) return renderPanelShape(component, bounds);
  if (isNoteComponent(component)) return renderNoteShape(component, bounds);
  if (isApiGroupComponent(component)) return renderApiGroupShape(bounds);
  if (isAwsComponent(component)) return renderAwsShape(bounds);
  if (component.type === "person") return renderPersonShape(bounds);
  if (isC4Component(component)) return renderC4Rect(component.type, bounds);
  if (isEndpointComponent(component)) return renderC4Rect("component", bounds);
  return renderC4Rect("component", bounds);
}

export function generatePreviewSvg(diagram: Diagram): string {
  const components = diagram.snapshot.components;
  const connections = diagram.snapshot.connections;
  const layouts = diagram.nodeLayouts;

  const visibleWithLayout = Object.values(components).filter(
    (c) => !c.hidden && layouts[c.id] !== undefined,
  );

  const boundsCache = new Map<string, { x: number; y: number; width: number; height: number }>();
  for (const c of visibleWithLayout) {
    getAbsoluteBounds(c.id, components, layouts, boundsCache);
  }

  const simplified = visibleWithLayout.length > MAX_ELEMENTS;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const c of visibleWithLayout) {
    const bounds = boundsCache.get(c.id);
    if (!bounds) continue;
    minX = Math.min(minX, bounds.x);
    minY = Math.min(minY, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.width);
    maxY = Math.max(maxY, bounds.y + bounds.height);
  }

  const padding = 40;
  if (!Number.isFinite(minX)) {
    const size = 200;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" preserveAspectRatio="xMidYMid meet"><rect width="${size}" height="${size}" fill="hsl(220 14% 96%)" fill-opacity="0.5"/></svg>`;
  }

  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;

  const viewW = Math.max(1, maxX - minX);
  const viewH = Math.max(1, maxY - minY);

  const lines = renderConnectionLines(connections, boundsCache);

  const panels: string[] = [];
  const nonPanels: string[] = [];

  for (const c of visibleWithLayout) {
    const bounds = boundsCache.get(c.id);
    if (!bounds) continue;
    const shape = shapeForComponent(c, bounds, simplified);
    if (!shape) continue;
    if (isPanelComponent(c)) panels.push(shape);
    else nonPanels.push(shape);
  }

  const body = [...lines, ...panels, ...nonPanels].join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX.toFixed(1)} ${minY.toFixed(1)} ${viewW.toFixed(1)} ${viewH.toFixed(1)}" preserveAspectRatio="xMidYMid meet">${body}</svg>`;
}
