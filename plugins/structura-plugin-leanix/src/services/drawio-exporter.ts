/**
 * Simplified Draw.io XML Exporter for LeanIX Plugin
 *
 * Generates a valid Draw.io XML from the DiagramSnapshot provided by the plugin API.
 * This is a self-contained implementation that doesn't depend on any host APIs.
 */

import type { DiagramSnapshot, PluginComponentSnapshot, PluginConnectionSnapshot } from "../types/plugin";

interface Geometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface NodeLayout {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

// Configuration for the draw.io export
const CONFIG = {
  grid: {
    dx: 1425,
    dy: 1425,
    gridSize: 10,
  },
  pageWidth: 850,
  pageHeight: 600,
  minMargin: 20,
  defaults: {
    c4Width: 200,
    c4Height: 150,
    panelWidth: 400,
    panelHeight: 300,
    noteWidth: 200,
    noteHeight: 100,
    endpointWidth: 150,
    endpointHeight: 80,
    dbTableWidth: 200,
    dbTableHeight: 120,
  },
};

/**
 * Escape XML special characters
 */
function escXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Get the type category from component type
 */
function getTypeCategory(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("person") || t.includes("user")) return "person";
  if (t.includes("system") || t.includes("software")) return "system";
  if (t.includes("container") || t.includes("component")) return "container";
  if (t.includes("database") || t.includes("db") || t.includes("table")) return "database";
  if (t.includes("endpoint") || t.includes("api")) return "endpoint";
  if (t.includes("service")) return "service";
  if (t.includes("panel") || t.includes("group")) return "group";
  if (t.includes("note")) return "note";
  return "generic";
}

/**
 * Get fill color based on component type
 */
function getFillColor(type: string): string {
  const category = getTypeCategory(type);
  switch (category) {
    case "person":
      return "#08427B";
    case "system":
      return "#0F7B7D";
    case "container":
      return "#1168BD";
    case "database":
      return "#036A81";
    case "endpoint":
      return "#438DD5";
    case "service":
      return "#2E75B6";
    case "group":
      return "#FFFFFF";
    case "note":
      return "#FFFFCC";
    default:
      return "#D5E8D4";
  }
}

/**
 * Get stroke color based on component type
 */
function getStrokeColor(type: string): string {
  const category = getTypeCategory(type);
  switch (category) {
    case "person":
      return "#FFFFFF";
    case "system":
      return "#FFFFFF";
    case "container":
      return "#FFFFFF";
    case "database":
      return "#FFFFFF";
    case "endpoint":
      return "#FFFFFF";
    case "service":
      return "#FFFFFF";
    case "group":
      return "#8A8A8A";
    case "note":
      return "#666666";
    default:
      return "#82B366";
  }
}

/**
 * Get font color based on component type
 */
function getFontColor(type: string): string {
  const category = getTypeCategory(type);
  switch (category) {
    case "person":
    case "system":
    case "container":
    case "database":
    case "endpoint":
    case "service":
      return "#FFFFFF";
    case "note":
      return "#333333";
    default:
      return "#333333";
  }
}

/**
 * Get default dimensions for component type
 */
function getDefaultDimensions(type: string): { width: number; height: number } {
  const category = getTypeCategory(type);
  switch (category) {
    case "person":
      return { width: 100, height: 100 };
    case "system":
      return { width: CONFIG.defaults.c4Width * 1.5, height: CONFIG.defaults.c4Height * 1.2 };
    case "container":
      return { width: CONFIG.defaults.c4Width, height: CONFIG.defaults.c4Height };
    case "database":
      return { width: CONFIG.defaults.dbTableWidth, height: CONFIG.defaults.dbTableHeight };
    case "endpoint":
      return { width: CONFIG.defaults.endpointWidth, height: CONFIG.defaults.endpointHeight };
    case "note":
      return { width: CONFIG.defaults.noteWidth, height: CONFIG.defaults.noteHeight };
    default:
      return { width: 150, height: 80 };
  }
}

/**
 * Build geometry XML attribute string
 */
function buildGeometry(geom: Geometry): string {
  return `x="${geom.x}" y="${geom.y}" width="${geom.width}" height="${geom.height}"`;
}

/**
 * Build a draw.io cell for a component
 */
function buildComponentCell(
  component: PluginComponentSnapshot,
  layout: NodeLayout | null,
  parentId: string = "1"
): string {
  const defaults = getDefaultDimensions(component.type);
  const x = layout?.x ?? CONFIG.minMargin;
  const y = layout?.y ?? CONFIG.minMargin;
  const width = layout?.width ?? component.size?.width ?? defaults.width;
  const height = layout?.height ?? component.size?.height ?? defaults.height;

  const geom: Geometry = { x, y, width, height };
  const fillColor = getFillColor(component.type);
  const strokeColor = getStrokeColor(component.type);
  const fontColor = getFontColor(component.type);

  const style = [
    "rounded=0",
    `fillColor=${fillColor}`,
    `strokeColor=${strokeColor}`,
    `fontColor=${fontColor}`,
    "verticalAlign=middle",
    "align=center",
    "spacingLeft=4",
    "spacingRight=4",
    "spacingTop=4",
    "spacingBottom=4",
    "html=1",
  ].join(";");

  const escapedLabel = escXml(component.label || component.type);
  const escapedDescription = component.description ? escXml(component.description) : "";

  const labelText = escapedDescription
    ? `<mxCell style="${style}" vertex="1" parent="${parentId}">` +
      `<mxGeometry ${buildGeometry(geom)} as="geometry"}>` +
      `</mxGeometry>` +
      `</mxCell>` +
      `<mxCell id="${component.id}-label" value="${escapedLabel}" style="text;html=1;align=center;verticalAlign=middle;resizable=0;points=[];autosize=1;fontSize=10;fontColor=${fontColor}" vertex="1" connectable="0" parent="${component.id}">` +
      `</mxCell>`
    : `<mxCell id="${component.id}" value="${escapedLabel}" style="${style}" vertex="1" parent="${parentId}">` +
      `<mxGeometry ${buildGeometry(geom)} as="geometry">` +
      `</mxGeometry>` +
      `</mxCell>`;

  return labelText;
}

/**
 * Build a draw.io cell for a connection
 */
function buildConnectionCell(connection: PluginConnectionSnapshot): string {
  const style = [
    "endArrow=classic",
    "html=1",
    "exitX=0.5",
    "exitY=1",
    "exitDx=0",
    "exitDy=0",
    "entryX=0.5",
    "entryY=0",
    "entryDx=0",
    "entryDy=0",
  ].join(";");

  const escapedLabel = connection.label ? escXml(connection.label) : "";

  return `<mxCell id="${connection.id}" value="${escapedLabel}" style="${style}" edge="1" parent="1" source="${connection.sourceId}" target="${connection.targetId}">` +
    `<mxGeometry relative="1" as="geometry"/>` +
    `</mxCell>`;
}

/**
 * Export a diagram snapshot to draw.io XML format
 */
export function exportToDrawio(
  diagram: DiagramSnapshot,
  layouts?: Record<string, NodeLayout>
): string {
  // Build vertex cells
  const vertexCells: string[] = [`<mxCell id="0"/>`];
  vertexCells.push(`<mxCell id="1" parent="0"/>`);

  // Add component cells
  for (const component of diagram.components) {
    const layout = layouts?.[component.id] ?? null;
    const cell = buildComponentCell(component, layout);
    vertexCells.push(cell);
  }

  // Add connection cells
  const edgeCells: string[] = [];
  for (const connection of diagram.connections) {
    // Only add if both source and target exist
    const sourceExists = diagram.components.some(c => c.id === connection.sourceId);
    const targetExists = diagram.components.some(c => c.id === connection.targetId);
    if (sourceExists && targetExists) {
      const cell = buildConnectionCell(connection);
      edgeCells.push(cell);
    }
  }

  const allCells = [...vertexCells, ...edgeCells].join("");
  const slug = escXml(diagram.name || "diagram");

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<mxfile><diagram name="${slug}">` +
    `<mxGraphModel dx="${CONFIG.grid.dx}" dy="${CONFIG.grid.dy}" grid="1" gridSize="${CONFIG.grid.gridSize}" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="0" fit="1" pageScale="1" pageWidth="${CONFIG.pageWidth}" pageHeight="${CONFIG.pageHeight}" math="0" shadow="0" background="#ffffff">` +
    `<root>${allCells}</root>` +
    `</mxGraphModel></diagram></mxfile>`
  );
}

/**
 * Export diagram to draw.io with auto-layout
 */
export function exportToDrawioWithLayout(
  diagram: DiagramSnapshot,
  options?: {
    margin?: number;
    horizontalSpacing?: number;
    verticalSpacing?: number;
  }
): string {
  const margin = options?.margin ?? CONFIG.minMargin;
  const hSpacing = options?.horizontalSpacing ?? 50;
  const vSpacing = options?.verticalSpacing ?? 80;

  // Build layouts with simple grid layout
  const layouts: Record<string, NodeLayout> = {};

  // Get components with positions
  const positioned = diagram.components
    .filter(c => c.position)
    .sort((a, b) => {
      const posA = a.position!;
      const posB = b.position!;
      return posA.y - posB.y || posA.x - posB.x;
    });

  // Group by y position (rows)
  const rows: PluginComponentSnapshot[][] = [];
  let currentRow: PluginComponentSnapshot[] = [];
  let lastY = positioned[0]?.position?.y ?? 0;

  for (const comp of positioned) {
    const y = comp.position!.y;
    if (Math.abs(y - lastY) < 20) {
      currentRow.push(comp);
    } else {
      if (currentRow.length > 0) rows.push(currentRow);
      currentRow = [comp];
      lastY = y;
    }
  }
  if (currentRow.length > 0) rows.push(currentRow);

  // Calculate positions
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    let x = margin;
    const y = margin + rowIndex * (CONFIG.defaults.c4Height + vSpacing);

    for (const comp of row) {
      const defaults = getDefaultDimensions(comp.type);
      const width = comp.size?.width ?? defaults.width;
      const height = comp.size?.height ?? defaults.height;

      layouts[comp.id] = {
        x,
        y,
        width,
        height,
      };

      x += width + hSpacing;
    }
  }

  // Add components without positions at the end
  const unpositioned = diagram.components.filter(c => !c.position);
  let nextX = margin;
  let nextY = margin + rows.length * (CONFIG.defaults.c4Height + vSpacing);

  for (const comp of unpositioned) {
    const defaults = getDefaultDimensions(comp.type);
    const width = comp.size?.width ?? defaults.width;
    const height = comp.size?.height ?? defaults.height;

    if (nextX + width > CONFIG.pageWidth - margin) {
      nextX = margin;
      nextY += height + vSpacing;
    }

    layouts[comp.id] = {
      x: nextX,
      y: nextY,
      width,
      height,
    };

    nextX += width + hSpacing;
  }

  return exportToDrawio(diagram, layouts);
}
