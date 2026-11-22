import type { FlowNodeShape, PanelKind } from "./component.types";
import type { JsonObject } from "./diagram-kind";
import type { Flow } from "./flow.types";

/**
 * The change set a diagram kind hands the store (ADR-0014): the plugin
 * `applyChanges` vocabulary (remove, disconnect, update, move, add, connect)
 * plus what a kind needs on top — re-parenting, re-wiring and relabelling a
 * connection, flows and the kind's own data. It lives in the model so the store
 * applies it without importing the kind registry.
 */

/** A node a kind edit creates. `key` names it inside the edit; the result maps it to an id. */
export interface KindNodeInput {
  key: string;
  type: string;
  name: string;
  description?: string;
  /** Another node's `key` in the same edit, or an existing component id; null for top level. */
  parent: string | null;
  panelKind?: PanelKind;
  flowShape?: FlowNodeShape;
  /** For a swimlane: its orientation and accent. Its header label follows `name`. */
  lane?: { orientation?: "horizontal" | "vertical"; color?: string };
  /** The kind's data on the element (`Component.kindProps`). */
  kindProps?: JsonObject;
  /** Relative to the parent, like React Flow child nodes. */
  x: number;
  y: number;
  width?: number;
  height?: number;
}

/** A connection a kind edit creates; ends are `KindNodeInput.key`s or existing component ids. */
export interface KindEdgeInput {
  source: string;
  target: string;
  label?: string;
}

export interface KindEdit {
  remove?: string[];
  disconnect?: string[];
  update?: Array<{
    id: string;
    name?: string;
    description?: string;
    flowShape?: FlowNodeShape;
    /** Replaces the element's kind data; null clears it. */
    kindProps?: JsonObject | null;
  }>;
  move?: Array<{ id: string; x: number; y: number; width?: number; height?: number }>;
  add?: KindNodeInput[];
  connect?: KindEdgeInput[];
  /** Re-wires an existing connection; ends are node keys or existing ids. */
  reconnect?: Array<{ id: string; source?: string; target?: string }>;
  /** Sets a swimlane's orientation (a reading-direction switch). */
  laneOrientation?: Array<{ id: string; orientation: "horizontal" | "vertical" }>;
  /** Moves a component into another parent at a position relative to it. */
  reparent?: Array<{ id: string; parent: string | null; x: number; y: number }>;
  relabel?: Array<{ id: string; label: string }>;
  flows?: { set?: Flow[]; remove?: string[] };
  /** Replaces the diagram's kind data. */
  kindData?: JsonObject;
}

export interface KindEditResult {
  idsByKey: Record<string, string>;
  /** Per `connect` entry, in order: the connection created, or null when its ends did not resolve. */
  connectionIds: Array<string | null>;
}

/** True when the edit changes nothing. */
export function isEmptyKindEdit(edit: KindEdit): boolean {
  return (
    !edit.remove?.length &&
    !edit.disconnect?.length &&
    !edit.update?.length &&
    !edit.move?.length &&
    !edit.add?.length &&
    !edit.connect?.length &&
    !edit.reconnect?.length &&
    !edit.reparent?.length &&
    !edit.relabel?.length &&
    !edit.laneOrientation?.length &&
    !edit.flows?.set?.length &&
    !edit.flows?.remove?.length &&
    edit.kindData === undefined
  );
}
