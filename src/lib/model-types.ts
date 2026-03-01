// Core model types — source of truth for all architectural data.
// React Flow is a projection layer; these types define the actual model.

import type { AwsCategoryId } from "./aws-catalog";

export type C4ElementType =
  | "person" | "system" | "container" | "component"
  | AwsCategoryId;

export type C4Level = "context" | "container" | "component";

/** A globally unique architectural element */
export interface ArchElement {
  id: string;
  name: string;
  type: C4ElementType;
  description: string;
  technology?: string;
  parentId: string | null; // null = top-level
  tags?: string[];
  /** When type is an AWS category, this specifies the exact service (e.g. "lambda", "s3") */
  awsService?: string;
}

/** A first-class relationship between two elements */
export interface ArchRelationship {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  technology?: string;
  description?: string;
}

/** Visual layout metadata for a single element in a view */
export interface ViewNodeLayout {
  elementId: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

/** A view is a projection of the model at a specific C4 level */
export interface ArchView {
  id: string;
  name: string;
  level: C4Level;
  rootElementId: string | null; // which element we're "inside" (null = top-level context)
  nodeLayouts: ViewNodeLayout[];
  viewport: { x: number; y: number; zoom: number };
}

/** The complete working draft — everything that gets snapshotted on commit */
export interface ModelDraft {
  elements: Record<string, ArchElement>;
  relationships: Record<string, ArchRelationship>;
  views: Record<string, ArchView>;
  activeViewId: string;
}

/** An immutable committed version */
export interface ModelVersion {
  id: string;
  version: string;
  parentId: string | null;
  timestamp: string;
  author: string;
  message: string;
  snapshot: ModelDraft;
}

// Helper to generate IDs
let _counter = 0;
export const generateId = (prefix: string = "el") =>
  `${prefix}-${Date.now().toString(36)}-${(++_counter).toString(36)}`;
