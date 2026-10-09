import { PanelKind } from "@/features/diagram/enums";
import type { ComponentType } from "@/features/diagram/model/component.types";
import type { ElementCreateOptions } from "@/features/elements/element.types";
import type { PatternEdge, PatternEdgeLabel, PatternNode, PatternRole } from "./types";

/** Shorthands for authoring patterns: the data stays plain objects. */

/** An application service (a C4 container) at a cell. */
export function service(key: string, col: number, row: number, parent?: string): PatternNode {
  return { key, col, row, ...(parent ? { parent } : {}) };
}

/** A node doing an infrastructure job, resolved per provider. */
export function role(
  key: string,
  r: PatternRole,
  col: number,
  row: number,
  parent?: string,
): PatternNode {
  return { key, role: r, col, row, ...(parent ? { parent } : {}) };
}

/** A node of a given element type (a person, an external system…). */
export function element(
  key: string,
  type: ComponentType,
  col: number,
  row: number,
  options: { parent?: string; createOptions?: ElementCreateOptions } = {},
): PatternNode {
  return { key, type, col, row, ...options };
}

/** A boundary (a panel) its children are placed inside. */
export function boundary(key: string, col: number, row: number): PatternNode {
  return { key, type: "panel", createOptions: { panelKind: PanelKind.Default }, col, row };
}

export function edge(from: string, to: string, label: PatternEdgeLabel): PatternEdge {
  return { from, to, label };
}
