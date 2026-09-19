import type { Diagram } from "../model/diagram.types";
import type { Component } from "../model/component.types";
import type { Connection } from "../model/connection.types";
import { isPanelComponent } from "../model/component.guards";

/**
 * Represents a single node in the accessibility tree.
 */
export interface AccessibilityNode {
  /** Unique identifier for the element */
  id: string;
  /** Human-readable label */
  label: string;
  /** Type of element in the tree */
  type: "component" | "connection" | "group" | "diagram";
  /** Parent node ID, null for root-level items */
  parentId: string | null;
  /** Number of direct children (for groups) */
  childCount: number;
  /** Screen reader role/typename */
  role: string;
  /** Position for spatial context */
  position?: { x: number; y: number };
}

/**
 * Complete accessibility data for a diagram.
 */
export interface AccessibilityData {
  diagramId: string;
  diagramName: string;
  /** All nodes organized as a tree */
  nodes: AccessibilityNode[];
  /** Flat list for linear/sequential navigation */
  flatOrder: string[];
}

/**
 * Builds an accessibility tree from a diagram.
 *
 * Structure:
 * - Diagram root (for context)
 * - Panel groups (as collapsible containers)
 * - Individual components (grouped under panels if they have a parentId)
 * - Connections (at the root level, labeled with source → target)
 *
 * @param diagram - The diagram to extract accessibility data from
 * @returns AccessibilityData suitable for rendering an accessible outline
 */
export function getAccessibilityData(diagram: Diagram): AccessibilityData {
  const nodes: AccessibilityNode[] = [];
  const flatOrder: string[] = [];

  // Add diagram as root node
  nodes.push({
    id: diagram.id,
    label: diagram.name,
    type: "diagram",
    parentId: null,
    childCount: 0,
    role: "diagram",
  });
  flatOrder.push(diagram.id);

  const components = diagram.snapshot.components;
  const connections = diagram.snapshot.connections;
  const layouts = diagram.nodeLayouts;

  // Get top-level panels (groups)
  const panels = Object.values(components).filter(
    (c) => !c.parentId && isPanelComponent(c),
  );

  // Add panel groups
  for (const panel of panels) {
    const children = Object.values(components).filter((c) => c.parentId === panel.id);
    nodes.push({
      id: panel.id,
      label: panel.name,
      type: "group",
      parentId: diagram.id,
      childCount: children.length,
      role: "group",
    });
    flatOrder.push(panel.id);
  }

  // Add components (not panels, not children of panels)
  for (const component of Object.values(components)) {
    // Skip panels (handled above)
    if (isPanelComponent(component)) continue;
    // Skip components that are children of panels
    if (component.parentId && isPanelComponent(components[component.parentId])) continue;
    // Skip children of other components
    if (component.parentId && components[component.parentId]) continue;

    const layout = layouts[component.id];
    nodes.push({
      id: component.id,
      label: component.name,
      type: "component",
      parentId: component.parentId ?? diagram.id,
      childCount: 0,
      role: component.type,
      position: layout ? { x: layout.x, y: layout.y } : undefined,
    });
    flatOrder.push(component.id);
  }

  // Add connections
  for (const connection of Object.values(connections)) {
    const source = components[connection.sourceId];
    const target = components[connection.targetId];

    const label = connection.label ||
      `${source?.name ?? "?"} → ${target?.name ?? "?"}`;

    nodes.push({
      id: connection.id,
      label,
      type: "connection",
      parentId: null,
      childCount: 0,
      role: "connection",
    });
    flatOrder.push(connection.id);
  }

  return {
    diagramId: diagram.id,
    diagramName: diagram.name,
    nodes,
    flatOrder,
  };
}

/**
 * Gets a human-readable type label for a component.
 * Can be used with i18n for localization.
 */
export function getComponentTypeLabel(component: Component): string {
  return component.type;
}
