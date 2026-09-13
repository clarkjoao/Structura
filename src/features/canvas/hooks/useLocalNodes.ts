/**
 * Shared drag state for the pointer funnel.
 *
 * `selectedBeforeDrag` is consulted by `useCanvasEventHandlers.onSelectionChange`
 * to merge a node that was dragged while unselected with the prior selection
 * (decision #3 — drag unselected replaces; we keep the prior set visible until
 * React Flow raises the next selection event). The funnel populates this on
 * pointerdown of an unselected node.
 *
 * The drag-threshold gate that used to live here compared `change.position`,
 * which `snapGrid=[15,15]` had already quantised — so the distance was always
 * 0 or ≥ 15 and the gate never fired. Phase 4 moves threshold measurement to
 * the raw pointer coordinate inside the funnel (`dragThreshold.ts`).
 */

import { useEffect, useRef, useState, useCallback, type MutableRefObject } from "react";
import { applyNodeChanges, type Node, type NodeChange, type OnNodesChange } from "@xyflow/react";
import type { Diagram, DiagramModel } from "@/features/diagram";
import { canMoveNodeInSceneMode, useDiagramStore } from "@/features/diagram";

/** Refs shared between useLocalNodes and the event handlers for drag-selection parity. */
export const dragSelectionRef = {
  /** Set when a drag gesture starts on an unselected node — funnel writes this on pointerdown. */
  selectedBeforeDrag: new Set<string>(),
  /** Set while a drag gesture is in progress; cleared on drag end. */
  isDragging: false,
};

function filterNodeChangesForSceneMoveLock(
  diagram: Diagram | DiagramModel | null | undefined,
  changes: NodeChange[],
): NodeChange[] {
  if (!diagram) return changes;
  return changes.filter((c) => {
    if (c.type === "position" || c.type === "dimensions") {
      return canMoveNodeInSceneMode(diagram, c.id);
    }
    return true;
  });
}

/**
 * True when the store jumped to another point in history, so the local node
 * copy describes a diagram that no longer exists and has to be dropped.
 *
 * Named for the decision, not for the signal: this used to compare
 * `nodeLayouts` by identity, which *every* store write changes — a plain drag
 * commit was indistinguishable from an undo, so every commit took the discard
 * path below and handed React Flow 400 nodes stripped of `measured`. The name
 * said "undo/redo" while the body said "something moved", and that gap cost
 * several investigations. `_lastUndoRedoAt` is stamped only by `undo` and
 * `redo` in `history.slice.ts`, which is the question actually being asked.
 */
function shouldDiscardLocalNodes(
  prevDiagram: Diagram | DiagramModel | null | undefined,
  nextDiagram: Diagram | DiagramModel | null | undefined,
  prevLastUndoRedoAt: number,
  lastUndoRedoAt: number,
): boolean {
  if (!prevDiagram || !nextDiagram) return false;
  if (prevDiagram.id !== nextDiagram.id) return false;
  return prevLastUndoRedoAt !== lastUndoRedoAt;
}

/**
 * Re-attaches React Flow's measured sizes to a store-derived node array.
 *
 * The store never carries `measured`: only React Flow knows it, and it reaches
 * the local copy through `dimensions` changes. Hand React Flow a node without
 * it and `parseHandles` (`@xyflow/system`) drops that node's `handleBounds` —
 * Structura nodes carry no `handles` either, so there is nothing left to
 * rebuild the bounds from. `getEdgePosition` then returns `null` for every
 * edge touching the node and `EdgeWrapper` renders `null`, so on a whole-array
 * replacement the entire edge layer unmounts and only comes back once the
 * ResizeObserver has measured again. Measured on 400 nodes / 439 edges: 1756
 * `childList` mutations and ~184 ms of extra long task per drag commit.
 * See `docs/investigation/edge-relayer.md`.
 *
 * Only `measured` crosses over. Everything else — position, parenting,
 * selection — must come from the store, which is the point of the discard.
 *
 * Returns the input array untouched when there is nothing to carry over, so an
 * unchanged array keeps its identity and React Flow is not re-seeded for free.
 */
function withLocalMeasured(storeNodes: Node[], localNodes: Node[]): Node[] {
  if (localNodes.length === 0) return storeNodes;

  const measuredById = new Map<string, Node["measured"]>();
  for (const node of localNodes) {
    if (node.measured?.width !== undefined) measuredById.set(node.id, node.measured);
  }
  if (measuredById.size === 0) return storeNodes;

  let changed = false;
  const adopted = storeNodes.map((node) => {
    const measured = measuredById.get(node.id);
    if (!measured || node.measured === measured) return node;
    changed = true;
    return { ...node, measured };
  });
  return changed ? adopted : storeNodes;
}

/**
 * A frame of an in-progress drag: React Flow reports one position change per
 * dragged node, all with `dragging: true`. The last event of a gesture carries
 * `dragging: false`, so it falls through to the tick and lets the `nodes` prop
 * catch up with what React Flow already has.
 */
function isDragFrame(changes: NodeChange[]): boolean {
  for (const change of changes) {
    if (change.type !== "position") return false;
    if (!change.dragging) return false;
  }
  return true;
}

export function useLocalNodes(
  storeNodes: Node[],
  innerOnNodesChange: OnNodesChange,
  localNodesRef: MutableRefObject<Node[]>,
  onSelectionFromChanges?: (selectedIds: string[]) => void,
  diagram?: Diagram | DiagramModel | null,
  /**
   * Hands a drag frame's merged nodes straight to React Flow's store. React
   * Flow is controlled here, so the merged array has to reach `setNodes` or the
   * dragged node does not move; ticking React to re-render the Canvas is one
   * way to get there, and it re-runs the whole controller hook chain once per
   * pointermove. Without this the tick is still the path, so the hook stays
   * usable (and testable) outside a React Flow provider.
   */
  publishDragFrame?: (nodes: Node[]) => void,
) {
  const [, setTick] = useState(0);

  /** While true, NodeResizer updates dimensions in local state before the store catches up — keep local style/size. */
  const resizingNodeIdsRef = useRef(new Set<string>());
  const prevStoreNodesRef = useRef<Node[] | undefined>(undefined);
  const prevDiagramRef = useRef<Diagram | DiagramModel | null | undefined>(undefined);
  /** Detects active diagram switch — must reset locals even when `storeNodes` keeps the same ref (e.g. EMPTY_CANVAS_NODE_LIST). */
  const prevActiveDiagramIdRef = useRef<string | null>(null);
  /** Merged local nodes — held in a ref, not state, so the merge below never schedules a render. */
  const localNodesStateRef = useRef<Node[]>([]);

  /**
   * Stamped only by `undo`/`redo`. A primitive, so this subscription re-renders
   * the canvas on history jumps and on nothing else.
   */
  const lastUndoRedoAt = useDiagramStore((state) => state._lastUndoRedoAt);
  const prevLastUndoRedoAtRef = useRef(lastUndoRedoAt);

  const activeDiagramId = diagram?.id ?? null;

  // Derived state, computed during render on purpose. In a layout effect the merge would only land
  // in the refs *after* this render returned, so React Flow would paint the previous nodes — with
  // `selected` now sourced from the store that means the previous selection ring and dim. Ticking a
  // re-render from the effect to compensate is not an option either: `selected` flows store ->
  // local nodes -> React Flow's internal selection -> onSelectionChange -> store, and re-rendering
  // from inside that ring turns any disagreement into "Maximum update depth exceeded". No setState
  // here, so nothing to warn about; the guards below make it idempotent per `storeNodes` identity.
  {
    if (activeDiagramId !== prevActiveDiagramIdRef.current) {
      prevActiveDiagramIdRef.current = activeDiagramId;
      resizingNodeIdsRef.current.clear();
      dragSelectionRef.selectedBeforeDrag.clear();
      dragSelectionRef.isDragging = false;
      localNodesStateRef.current = storeNodes;
      localNodesRef.current = storeNodes;
      prevStoreNodesRef.current = storeNodes;
      prevDiagramRef.current = diagram;
      prevLastUndoRedoAtRef.current = lastUndoRedoAt;
    } else if (storeNodes !== prevStoreNodesRef.current) {
      prevStoreNodesRef.current = storeNodes;

      const discardLocal = shouldDiscardLocalNodes(
        prevDiagramRef.current,
        diagram,
        prevLastUndoRedoAtRef.current,
        lastUndoRedoAt,
      );
      prevDiagramRef.current = diagram;
      prevLastUndoRedoAtRef.current = lastUndoRedoAt;

      const prev = localNodesStateRef.current;

      if (prev.length === 0 || discardLocal) {
        // Positions, parenting and selection come from the store — that is the
        // point of discarding. `measured` is not stale state, it is the only
        // record of what React Flow painted, so it has to survive.
        const adopted = withLocalMeasured(storeNodes, prev);
        localNodesStateRef.current = adopted;
        localNodesRef.current = adopted;
      } else if (prev.length !== storeNodes.length) {
        const localMap = new Map(prev.map((n) => [n.id, n]));
        const merged = storeNodes.map((sn) => {
          const ln = localMap.get(sn.id);
          if (!ln) return sn;
          const useRemotePosition = sn.parentId !== ln.parentId;
          const keepLocalDimensions = resizingNodeIdsRef.current.has(sn.id);
          return {
            ...ln,
            data: sn.data,
            style: keepLocalDimensions ? ln.style : sn.style,
            width: keepLocalDimensions ? ln.width : sn.width,
            height: keepLocalDimensions ? ln.height : sn.height,
            hidden: sn.hidden,
            draggable: sn.draggable,
            selectable: sn.selectable,
            focusable: sn.focusable,
            className: sn.className,
            dragHandle: sn.dragHandle,
            zIndex: sn.zIndex,
            connectable: sn.connectable,
            selected: sn.selected,
            type: sn.type,
            position: useRemotePosition ? sn.position : ln.position,
            parentId: sn.parentId,
            extent: sn.extent,
          };
        });
        localNodesStateRef.current = merged;
        localNodesRef.current = merged;
      } else {
        const localMap = new Map(prev.map((n) => [n.id, n]));
        let anyChanged = false;
        const merged = storeNodes.map((sn) => {
          const ln = localMap.get(sn.id);
          if (!ln) {
            anyChanged = true;
            return sn;
          }

          const useRemotePosition = sn.parentId !== ln.parentId;

          const positionToUse = useRemotePosition ? sn.position : ln.position;
          const keepLocalDimensions = resizingNodeIdsRef.current.has(sn.id);
          const styleToUse = keepLocalDimensions ? ln.style : sn.style;
          const widthToUse = keepLocalDimensions ? ln.width : sn.width;
          const heightToUse = keepLocalDimensions ? ln.height : sn.height;

          if (
            ln.data === sn.data &&
            ln.style === styleToUse &&
            ln.width === widthToUse &&
            ln.height === heightToUse &&
            ln.hidden === sn.hidden &&
            ln.draggable === sn.draggable &&
            ln.selectable === sn.selectable &&
            ln.focusable === sn.focusable &&
            ln.className === sn.className &&
            ln.dragHandle === sn.dragHandle &&
            ln.zIndex === sn.zIndex &&
            ln.connectable === sn.connectable &&
            ln.selected === sn.selected &&
            ln.type === sn.type &&
            ln.position === positionToUse &&
            ln.parentId === sn.parentId &&
            ln.extent === sn.extent
          ) {
            return ln;
          }

          anyChanged = true;
          return {
            ...ln,
            data: sn.data,
            style: styleToUse,
            width: widthToUse,
            height: heightToUse,
            hidden: sn.hidden,
            draggable: sn.draggable,
            selectable: sn.selectable,
            focusable: sn.focusable,
            className: sn.className,
            dragHandle: sn.dragHandle,
            zIndex: sn.zIndex,
            connectable: sn.connectable,
            selected: sn.selected,
            type: sn.type,
            position: positionToUse,
            parentId: sn.parentId,
            extent: sn.extent,
          };
        });

        if (anyChanged) {
          localNodesStateRef.current = merged;
          localNodesRef.current = merged;
        }
      }
    }
  }

  /**
   * Drag threshold (Phase 4) moved to `selection/dragThreshold.ts` and the
   * pointer funnel — it must read raw pointer coordinates, BEFORE any snap.
   * The previous implementation here compared `change.position`, which is
   * already snapped to `snapGrid=[15,15]`, so the gate never fired. See the
   * header comment for the regression history.
   *
   * The remaining fallback below ensures stale `resizing` overrides clear if
   * React Flow omits `resizing: false` on the last dimensions event.
   */
  useEffect(() => {
    const endResizeGestureFallback = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (resizingNodeIdsRef.current.size === 0) return;
          resizingNodeIdsRef.current.clear();
          setTick((tick) => tick + 1);
        });
      });
    };
    window.addEventListener("pointerup", endResizeGestureFallback);
    window.addEventListener("pointercancel", endResizeGestureFallback);
    return () => {
      window.removeEventListener("pointerup", endResizeGestureFallback);
      window.removeEventListener("pointercancel", endResizeGestureFallback);
    };
  }, []);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      if (!changes.length) return;

      // Phase 4: drag-threshold gate moved to `selection/pointerFunnel.ts`.
      // All we do here is capture the prior selection for the unselected-drag
      // merge (decision #3) so `onSelectionChange` can restore it.
      // The two ref guards below are checked first on purpose: they do not depend on
      // the node, and once a gesture is under way they are both true. Scanning the
      // node list before them put two O(N) passes on every frame of every drag.
      for (const change of changes) {
        if (change.type !== "position") continue;
        if (!change.dragging) continue;
        if (dragSelectionRef.isDragging) continue;
        if (dragSelectionRef.selectedBeforeDrag.size > 0) continue;

        const node = localNodesStateRef.current.find((n) => n.id === change.id);
        if (!node) continue;
        if (node.selected) continue;

        const currentSelected = localNodesStateRef.current
          .filter((n) => n.selected)
          .map((n) => n.id);
        if (currentSelected.length === 0) continue;
        dragSelectionRef.selectedBeforeDrag = new Set(currentSelected);
        dragSelectionRef.isDragging = true;
      }

      // Process dimension changes (resize)
      for (const change of changes) {
        if (change.type === "dimensions") {
          if (change.resizing === false) {
            resizingNodeIdsRef.current.delete(change.id);
          } else {
            resizingNodeIdsRef.current.add(change.id);
          }
        }
      }

      const sanitizedChanges = changes.map((change) => {
        if (change.type !== "replace") return change;
        const previousNode = localNodesRef.current.find((node) => node.id === change.item.id);
        const previousData = previousNode?.data as Record<string, unknown> | undefined;
        const nextData = change.item.data as Record<string, unknown> | undefined;
        if (!previousData || !nextData) return change;
        const templateId =
          typeof previousData.templateId === "string" ? previousData.templateId : undefined;
        if (!templateId) return change;
        const keys = new Set([...Object.keys(previousData), ...Object.keys(nextData)]);
        const changedAnyField = [...keys].some((key) => {
          if (key === "templateId") return false;
          return previousData[key] !== nextData[key];
        });
        if (!changedAnyField) return change;
        const nextItemData = { ...nextData };
        delete nextItemData.templateId;
        return {
          ...change,
          item: {
            ...change.item,
            data: nextItemData,
          },
        };
      });
      const hasSelect = changes.some((c) => c.type === "select");
      innerOnNodesChange(sanitizedChanges);
      const forApply = filterNodeChangesForSceneMoveLock(diagram, sanitizedChanges);

      const updated = applyNodeChanges(forApply, localNodesStateRef.current);
      localNodesStateRef.current = updated;
      localNodesRef.current = updated;

      if (hasSelect && onSelectionFromChanges) {
        const selectedIds = updated.filter((n) => n.selected).map((n) => n.id);
        onSelectionFromChanges(selectedIds);
      }

      if (publishDragFrame && isDragFrame(changes)) {
        publishDragFrame(updated);
        return;
      }

      setTick((tick) => tick + 1);
    },
    [diagram, innerOnNodesChange, localNodesRef, onSelectionFromChanges, publishDragFrame],
  );

  return { nodes: localNodesStateRef.current, onNodesChange };
}
