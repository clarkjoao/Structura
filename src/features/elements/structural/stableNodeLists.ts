import type { FlowRef } from "@/features/diagram";

/**
 * Lists a node builder derives, handed back with the identity they had on the
 * previous build when their content is the same.
 *
 * The canvas keeps a node's previous `data` while every field is the same
 * value (`useCanvasNodes`), and a derived list is a new array on every build.
 * Every build — the first selection, every return to an empty one — then gave
 * each API group and route on the canvas new data and re-ran its renderer,
 * although nothing it draws had changed.
 *
 * Keyed by the component record, which keeps its identity while the component
 * is unchanged, so the cache lets go of whatever the diagram no longer holds.
 */
const NONE: readonly never[] = Object.freeze([]);

function stableList<T>(
  cache: WeakMap<object, readonly T[]>,
  owner: object,
  next: readonly T[],
  same: (a: T, b: T) => boolean,
): readonly T[] {
  if (next.length === 0) return NONE;
  const previous = cache.get(owner);
  if (
    previous &&
    previous.length === next.length &&
    previous.every((item, index) => same(item, next[index]!))
  ) {
    return previous;
  }
  cache.set(owner, next);
  return next;
}

const flowRefsByOwner = new WeakMap<object, readonly FlowRef[]>();
const namesByOwner = new WeakMap<object, readonly string[]>();

/** `next`, or the equal list this owner built last time. */
export function stableFlowRefs(owner: object, next: readonly FlowRef[]): readonly FlowRef[] {
  return stableList(flowRefsByOwner, owner, next, (a, b) => a.id === b.id && a.name === b.name);
}

/** `next`, or the equal list this owner built last time. */
export function stableNames(owner: object, next: readonly string[]): readonly string[] {
  return stableList(namesByOwner, owner, next, (a, b) => a === b);
}

/**
 * The slot for a callback the renderer writes onto its own data once mounted
 * (`NoteNode`, `JsonViewerNode`: `data.onStartEdit = …`, read by the canvas
 * double-click). Built absent, the written key made the kept data one key
 * longer than every fresh build, so the canvas never kept it and each build
 * re-ran every such node. Built as a placeholder, the key is there on both
 * sides and the comparison, which ignores functions, keeps the written one.
 */
export function unmountedRendererCallback(): void {}

/** The one empty list, for a field with nothing in it. */
export function orNone<T>(list: readonly T[] | undefined): readonly T[] {
  return list && list.length > 0 ? list : NONE;
}
