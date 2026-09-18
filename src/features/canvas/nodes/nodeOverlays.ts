import type { CSSProperties } from "react";
import type { Node } from "@xyflow/react";
import type { CompareElementVisual } from "@/features/diagram";
import {
  OPACITY_FLOW_PLAYBACK_NODE_DIM,
  OPACITY_TAG_FILTER_DIM,
  OPACITY_TAG_FILTER_TRANSITION,
} from "../constants/opacity";
import type { ViewNode } from "../core/resolveViewSnapshot";
import type { CoverageInfo } from "../flow/flowState";
import { isDimmedByCoverage, resolveSelectionFocus } from "./nodeVisibility";

/*
 * The editor's overlays on a projected node (`core/projectDiagram.ts`).
 *
 * The projection decides position, size, z-index, order, nesting and
 * visibility for both surfaces; these add what only the editor has. Each one
 * may only
 *   - add to `style` (opacity, pointer events, transition),
 *   - add a class,
 *   - turn an interaction off (drag, select, focus, connect) or mark a node
 *     selected,
 * and returns the node untouched when it does not apply, so an editor with
 * nothing selected, no comparison, no tag filter and no pending preview draws
 * exactly the projection. See docs/investigation/divergencia-edicao-visualizacao.md
 * §5.1 (slice 5).
 *
 * Order matters for opacity only, and `applyEditorNodeOverlays` fixes it:
 * the focus and coverage dims replace the descriptor's opacity, compare mode
 * then multiplies what is there, and the tag filter replaces it last. Classes
 * are kept in one canonical order whatever order they are added in, so the
 * class string is the one the editor has always produced.
 */

type InteractionFlag = "draggable" | "selectable" | "focusable" | "connectable";
const ALL_INTERACTION: readonly InteractionFlag[] = [
  "connectable",
  "draggable",
  "selectable",
  "focusable",
];

/** The order the editor has always joined these classes in. */
const CLASS_ORDER = [
  "cursor-default",
  "cursor-not-allowed",
  "node-pending",
  "node-diff-modified",
  "node-diff-removed",
  "node-diff-added",
];

function withClass(node: Node, className: string): Node {
  const classes = new Set((node.className ?? "").split(" ").filter(Boolean));
  classes.add(className);
  const ordered = [...classes].sort((a, b) => CLASS_ORDER.indexOf(a) - CLASS_ORDER.indexOf(b));
  return { ...node, className: ordered.join(" ") };
}

function withStyle(node: Node, patch: CSSProperties): Node {
  return { ...node, style: { ...node.style, ...patch } };
}

function withoutInteraction(node: Node, flags: readonly InteractionFlag[]): Node {
  const next: Node = { ...node };
  for (const flag of flags) next[flag] = false;
  return next;
}

/** Marks the node selected — React Flow draws the ring and raises it. */
export function selectedOverlay(
  node: Node,
  viewNode: ViewNode,
  selectedNodeIds: Set<string>,
): Node {
  return selectedNodeIds.has(viewNode.component.id) ? { ...node, selected: true } : node;
}

/**
 * Dims what does not have the focus while something is selected or
 * highlighted. Stands down while a flow is open: the flow owns opacity then.
 */
export function focusDimOverlay(
  node: Node,
  viewNode: ViewNode,
  selectedNodeIds: Set<string>,
  highlightedNodeIds: Set<string>,
  flowModeActive: boolean,
): Node {
  if (flowModeActive) return node;
  const { dimmedBySelection } = resolveSelectionFocus(
    viewNode.component,
    viewNode.isChild,
    viewNode.isHidden,
    selectedNodeIds,
    highlightedNodeIds,
  );
  return dimmedBySelection ? withStyle(node, { opacity: OPACITY_FLOW_PLAYBACK_NODE_DIM }) : node;
}

/** Coverage view: dims a node no flow walks through. Same channel as the focus dim. */
export function coverageDimOverlay(
  node: Node,
  viewNode: ViewNode,
  isViewingCoverage: boolean,
  coverage: CoverageInfo | null,
  flowModeActive: boolean,
): Node {
  if (flowModeActive) return node;
  return isDimmedByCoverage(viewNode.component, isViewingCoverage, coverage)
    ? withStyle(node, { opacity: OPACITY_FLOW_PLAYBACK_NODE_DIM })
    : node;
}

function compareDiffOutlineClass(visual: CompareElementVisual): string {
  const hasA = visual.badgeA !== undefined;
  const hasB = visual.badgeB !== undefined;
  if (hasA && hasB) return "node-diff-modified";
  if (hasA && !hasB) return "node-diff-removed";
  if (!hasA && hasB) return "node-diff-added";
  return "";
}

/**
 * Comparing two scenes: the node's opacity is scaled by what the comparison
 * makes of it, it is outlined by its diff, and nothing can be edited.
 */
export function compareOverlay(
  node: Node,
  isCompareMode: boolean,
  visual: CompareElementVisual | undefined,
): Node {
  let next = node;
  if (visual !== undefined) {
    const baseOpacity = typeof next.style?.opacity === "number" ? next.style.opacity : 1;
    next = withStyle(next, { opacity: baseOpacity * visual.opacity });
  }
  if (!isCompareMode) return next;
  next = withoutInteraction(withClass(next, "cursor-default"), ALL_INTERACTION);
  const diff = visual !== undefined ? compareDiffOutlineClass(visual) : "";
  return diff ? withClass(next, diff) : next;
}

/** A node the tag filter hides: faded, click-through, and inert. */
export function tagFilterOverlay(node: Node, hiddenByTag: boolean): Node {
  if (!hiddenByTag) return node;
  return withoutInteraction(
    withStyle(node, {
      opacity: OPACITY_TAG_FILTER_DIM,
      pointerEvents: "none",
      transition: OPACITY_TAG_FILTER_TRANSITION,
    }),
    ALL_INTERACTION,
  );
}

/**
 * A flow being read is a stage, not a workbench: nothing on it moves, joins
 * up or takes a selection. The flag has to be on every node — a node that
 * states `draggable` for itself outranks the canvas-wide setting.
 */
export function readingOverlay(node: Node, isReading: boolean): Node {
  return isReading ? withoutInteraction(node, ALL_INTERACTION) : node;
}

/** Locked, itself or through an ancestor: shown as such and not draggable. */
export function lockOverlay(node: Node, locked: boolean): Node {
  return locked ? withoutInteraction(withClass(node, "cursor-not-allowed"), ["draggable"]) : node;
}

/** In a scene, a node that belongs to the base cannot be moved from the scene. */
export function sceneLockOverlay(node: Node, lockedByScene: boolean): Node {
  return lockedByScene ? withoutInteraction(node, ["draggable"]) : node;
}

/** A node an LLM suggestion would add, waiting to be kept or discarded. */
export function pendingOverlay(node: Node, pending: boolean): Node {
  return pending ? withClass(node, "node-pending") : node;
}

export interface EditorNodeOverlayInput {
  selectedNodeIds: Set<string>;
  highlightedNodeIds: Set<string>;
  /** A flow is being played or recorded: the flow owns opacity. */
  flowModeActive: boolean;
  isViewingCoverage: boolean;
  coverage: CoverageInfo | null;
  isCompareMode: boolean;
  compareVisual: CompareElementVisual | undefined;
  hiddenByTag: boolean;
  isReading: boolean;
  locked: boolean;
  lockedByScene: boolean;
  pending: boolean;
}

/** Every editor overlay, in the one order opacity needs (see the module note). */
export function applyEditorNodeOverlays(
  node: Node,
  viewNode: ViewNode,
  input: EditorNodeOverlayInput,
): Node {
  let next = selectedOverlay(node, viewNode, input.selectedNodeIds);
  next = focusDimOverlay(
    next,
    viewNode,
    input.selectedNodeIds,
    input.highlightedNodeIds,
    input.flowModeActive,
  );
  next = coverageDimOverlay(
    next,
    viewNode,
    input.isViewingCoverage,
    input.coverage,
    input.flowModeActive,
  );
  next = compareOverlay(next, input.isCompareMode, input.compareVisual);
  next = tagFilterOverlay(next, input.hiddenByTag);
  next = readingOverlay(next, input.isReading);
  next = lockOverlay(next, input.locked);
  next = sceneLockOverlay(next, input.lockedByScene);
  return pendingOverlay(next, input.pending);
}
