import type { ComponentType } from "./component.types";
import type { ElementCreateOptions } from "@/features/elements/element.types";

/**
 * One node of a catalog pattern, resolved and ready to insert: element type,
 * label and geometry are final. Built by the pattern resolver
 * (`features/elements/patterns`), inserted by `insertPattern`.
 */
export interface PatternFragmentNode {
  type: ComponentType;
  name: string;
  /** Written on C4 and cloud cards only (the elements that carry it). */
  technology?: string;
  /** What the element is created with: a cloud `serviceId`, a `panelKind`… */
  createOptions: ElementCreateOptions;
  /** Index of the containing node in the same fragment; it comes first. */
  parentIndex: number | null;
  /** Relative to the parent, or to the fragment's top-left when top level. */
  x: number;
  y: number;
  /** Set for boundaries, sized to their children; others take the element's default size. */
  width?: number;
  height?: number;
}

export interface PatternFragmentEdge {
  from: number;
  to: number;
  label: string;
}

/** A catalog pattern after resolution. `width`/`height` bound its top-level nodes. */
export interface PatternFragment {
  patternId: string;
  nodes: PatternFragmentNode[];
  edges: PatternFragmentEdge[];
  width: number;
  height: number;
}
