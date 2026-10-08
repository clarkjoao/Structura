/**
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 * Copy of the host's src/lib/opscr-mapping, synced via `npm run sync-shared`.
 * Edit the source files and re-sync instead of changing this file.
 */

/**
 * The input is described structurally — only what the projection reads — so an
 * `opscr/core` `Workspace` satisfies it without this library importing opscr.
 */
export interface OpscrManifestInput {
  kind: string;
  metadata: { name: string };
  spec: Record<string, unknown>;
}

export interface OpscrWorkspaceInput {
  manifests: readonly OpscrManifestInput[];
}

/**
 * What a node is drawn as, in Structura's vocabulary. `type` is a component type
 * string ("panel", "container", "aws-database", …); adapters check it with the
 * app's guards when they build components. `catalogServiceId` becomes the
 * component's `cloudServiceId`, which only `cloudServiceIdWrite()` may write (ADR-0010).
 */
export interface ViewElement {
  type: string;
  catalogServiceId?: string;
  technology?: string;
}

export interface ViewNode {
  /** `Kind/name` — name is identity in opscr. */
  id: string;
  kind: string;
  name: string;
  description: string;
  /** Id of the boundary this node is drawn inside; null at the root. */
  parentId: string | null;
  /** A panel that may hold children. */
  isBoundary: boolean;
  element: ViewElement;
}

export interface ViewEdge {
  /** `<relationship name>#<edge index>` — stable for the same file. */
  id: string;
  sourceId: string;
  targetId: string;
  /** opscr edge type: calls, reads, writes, … */
  type: string;
  description: string;
}

export interface OmittedManifest {
  kind: string;
  name: string;
}

export type DroppedReason =
  /** An end is a Kind this view does not draw. */
  | "not-drawn"
  /** An end names a manifest that does not exist. */
  | "missing"
  /** A second `belongsTo` for the same element. */
  | "second-parent"
  /** A `belongsTo` that would make an element its own ancestor. */
  | "cycle";

export interface DroppedEdge {
  relationship: string;
  index: number;
  from: string;
  to: string;
  type: string;
  reason: DroppedReason;
}

export interface TechnicalView {
  nodes: ViewNode[];
  edges: ViewEdge[];
  omitted: OmittedManifest[];
  dropped: DroppedEdge[];
}
