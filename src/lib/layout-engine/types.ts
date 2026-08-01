/**
 * Layout engine state.
 *
 * Every pass is `(state) => state`: pure, no mutation of the input, no DOM. The engine is a
 * fold over these passes, which keeps each one independently testable and makes the origin
 * of any coordinate traceable to the pass that set it.
 */

import type { ComponentType } from "@/features/diagram";
import type { Anchor, Rect } from "./edge-ports";
import type { DensityHint } from "./constants";

/** Ordered layout column. The engine maps one tier to one column. */
export type Tier =
  "external" | "client" | "gateway" | "application" | "backend" | "data" | "cross-cutting";

export const TIER_ORDER: readonly Tier[] = [
  "external",
  "client",
  "gateway",
  "application",
  "backend",
  "data",
  "cross-cutting",
];

export type ConnectionIntent = "call" | "async-message" | "event" | "data-flow" | "dependency";

export type NodeEmphasis = "default" | "primary" | "muted";

/** A node being laid out. Geometry starts undefined and is filled in by the passes. */
export interface LayoutNode {
  id: string;
  type: ComponentType;
  name: string;
  technology?: string;
  description?: string;
  tier: Tier;
  emphasis: NodeEmphasis;
  awsService?: string;

  /** Set by P0. */
  width: number;
  height: number;
  /** Set by P1/P2 (or P4 for cross-cutting nodes). */
  x: number;
  y: number;

  /** Boundary that owns this node, if any. */
  boundaryId?: string;
}

export type BoundaryKind =
  | "system"
  | "container"
  | "api-group"
  | "trust-zone"
  | "aws-account"
  | "aws-vpc"
  | "aws-subnet"
  | "swimlane";

/** A container drawn around a set of nodes. Geometry is derived, never authored. */
export interface LayoutBoundary {
  id: string;
  name: string;
  kind: BoundaryKind;
  contains: string[];
  parentBoundaryId?: string;
  orderIndex?: number;

  x: number;
  y: number;
  width: number;
  height: number;
  /** Nesting depth, 0 for a top-level boundary. Deeper boundaries are laid out first. */
  depth: number;
}

export interface LayoutConnection {
  id: string;
  from: string;
  to: string;
  label?: string;
  technology?: string;
  intent: ConnectionIntent;
  isPrimaryPath: boolean;

  /** Set by P5. */
  sourceAnchor?: Anchor;
  targetAnchor?: Anchor;
}

/** One laid-out column. */
export interface LayoutColumn {
  tier: Tier;
  /** Left edge in flow coordinates. */
  x: number;
  /** Widest node in the column. */
  width: number;
  nodeIds: string[];
}

export interface LayoutState {
  nodes: Map<string, LayoutNode>;
  boundaries: Map<string, LayoutBoundary>;
  connections: LayoutConnection[];
  columns: LayoutColumn[];

  /** Tier order for this diagram; columns follow it. */
  tiers: readonly Tier[];
  density: DensityHint;
  /** Node ids on the happy path, in order. Drives ordering and emphasis. */
  primaryPath: string[];

  /** Problems the engine could not resolve on its own. */
  failures: LayoutFailure[];
}

/**
 * A condition the engine could not lay out. Surfaced to the caller rather than silently
 * falling back — a fallback layout that looks successful is the failure mode this whole
 * subsystem exists to remove.
 */
export interface LayoutFailure {
  code: string;
  message: string;
  nodeIds?: string[];
}

export type LayoutPass = (state: LayoutState) => LayoutState;

/** Absolute rect of a node, for geometry consumers. */
export function nodeRect(node: LayoutNode): Rect {
  return { x: node.x, y: node.y, width: node.width, height: node.height };
}

/** Absolute rect of a boundary. */
export function boundaryRect(boundary: LayoutBoundary): Rect {
  return {
    x: boundary.x,
    y: boundary.y,
    width: boundary.width,
    height: boundary.height,
  };
}

/** Shallow-copies the state so a pass can return a new object without mutating its input. */
export function cloneState(state: LayoutState): LayoutState {
  return {
    ...state,
    nodes: new Map([...state.nodes].map(([id, node]) => [id, { ...node }])),
    boundaries: new Map([...state.boundaries].map(([id, b]) => [id, { ...b }])),
    connections: state.connections.map((connection) => ({ ...connection })),
    columns: state.columns.map((column) => ({ ...column, nodeIds: [...column.nodeIds] })),
    failures: [...state.failures],
  };
}
