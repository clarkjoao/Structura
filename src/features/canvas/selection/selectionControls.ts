import { useCallback, useLayoutEffect, useSyncExternalStore } from "react";
import { useStoreApi } from "@xyflow/react";

/**
 * Whether a selection switches a node's own controls off: while something is
 * selected (and no flow is being played or recorded), every node outside the
 * selection draws its handles, links and buttons disabled.
 *
 * The answer used to travel on every node's `data`, so the first selection,
 * and every return to an empty one, gave each node on the canvas new data and
 * re-ran each renderer whole — about a thousand card renders per click on a
 * 1000-node diagram. It now lives in one small store per canvas, and the
 * controls read it themselves: a selection change re-renders the handles and
 * buttons whose answer changed, never the card around them.
 */
export interface SelectionControls {
  disables(elementId: string): boolean;
  subscribe(listener: () => void): () => void;
  /** `active` is false while a flow is played or recorded: the selection disables nothing then. */
  update(selectedNodeIds: ReadonlySet<string>, active: boolean): void;
}

const NOTHING_SELECTED: ReadonlySet<string> = new Set();

export function createSelectionControls(): SelectionControls {
  let selected = NOTHING_SELECTED;
  let active = true;
  const listeners = new Set<() => void>();
  return {
    disables: (elementId) => active && selected.size > 0 && !selected.has(elementId),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    update(nextSelected, nextActive) {
      if (nextSelected === selected && nextActive === active) return;
      selected = nextSelected;
      active = nextActive;
      listeners.forEach((listener) => listener());
    },
  };
}

/**
 * One store per React Flow instance, found through React Flow's own store so
 * the canvas that writes it and the nodes that read it need no provider of
 * their own: nodes render inside `<ReactFlow>`, the canvas around it.
 *
 * Keyed by the store's `getState`: `useStoreApi()` hands each component its
 * own wrapper object around the one store, but the same functions.
 */
const controlsByFlow = new WeakMap<object, SelectionControls>();

function useSelectionControls(): SelectionControls {
  const flowStore = useStoreApi().getState;
  let controls = controlsByFlow.get(flowStore);
  if (!controls) {
    controls = createSelectionControls();
    controlsByFlow.set(flowStore, controls);
  }
  return controls;
}

/** Whether the current selection disables this node's controls. A surface that never syncs a selection (the viewer) answers false. */
export function useSelectionDisablesControls(elementId: string): boolean {
  const controls = useSelectionControls();
  const getSnapshot = useCallback(() => controls.disables(elementId), [controls, elementId]);
  return useSyncExternalStore(controls.subscribe, getSnapshot, getSnapshot);
}

/**
 * Hands the canvas selection to its nodes' controls. Written in a layout
 * effect, so the controls follow in the same frame as the selection ring.
 */
export function useSyncSelectionControls(
  selectedNodeIds: ReadonlySet<string>,
  active: boolean,
): void {
  const controls = useSelectionControls();
  useLayoutEffect(() => {
    controls.update(selectedNodeIds, active);
  }, [controls, selectedNodeIds, active]);
}
