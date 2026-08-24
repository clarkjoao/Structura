import type { AslIssue } from "./asl.types";

/**
 * Neutral import plan — the contract between the ASL conversion (pure, in
 * `src/lib/asl`) and the canvas adapter that writes it to the store.
 *
 * Like the export IR of ADR-0009, it has no dependency on `@/features/*`: the
 * component-type strings below are a closed union the adapter maps onto real
 * `ComponentType` values, so neither side needs a cast to cross the boundary.
 */

/**
 * Structura component types the ASL importer can produce. `panel` is the only
 * container: React Flow nests a node visually only under a panel.
 */
export type AslComponentType =
  | "panel"
  | "note"
  | "container"
  | "aws-compute"
  | "aws-database"
  | "aws-integration"
  | "aws-networking"
  | "azure-database";

export type AslConnectionIntent =
  | "dependency"
  | "call"
  | "event"
  | "data-flow"
  | "async-message";

export type AslTransportPreset = "sync" | "async" | "event";

export interface AslPlanNode {
  /** `metadata.name` of the source manifest — stable across the whole plan. */
  key: string;
  componentType: AslComponentType;
  /** Cloud service id (AWS/Azure catalogs) when the provider names a real one. */
  cloudService?: string;
  name: string;
  description: string;
  technology?: string;
  /** `metadata.labels` flattened to `key:value`. */
  tags: string[];
  parentKey: string | null;
  /** True for a node that holds — or is allowed to hold — children. */
  isContainer: boolean;
  /**
   * Notes stay out of the layout graph (the canvas auto-layout excludes notes
   * too) and are placed next to this node once the geometry is known. Absent
   * when nothing in the document says where the note belongs.
   */
  anchorKey?: string;
}

export interface AslPlanEdge {
  key: string;
  sourceKey: string;
  targetKey: string;
  label: string;
  description: string;
  intent: AslConnectionIntent;
  transportPreset?: AslTransportPreset;
}

export interface AslImportPlan {
  nodes: AslPlanNode[];
  edges: AslPlanEdge[];
  /** Non-fatal findings. The import proceeds and the UI reports them. */
  warnings: AslIssue[];
}

/** A note never participates in the layout graph. */
export function isPlanNote(node: AslPlanNode): boolean {
  return node.componentType === "note";
}
