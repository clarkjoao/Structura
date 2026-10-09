import { useCallback, useEffect, useMemo, useRef } from "react";
import type { Node } from "@xyflow/react";
import { LIMITS } from "@collab-protocol";
import { useCollab } from "../components/CollabProvider";
import { useCollabStore } from "../store/collab.store";

/**
 * Soft locks for the two gestures that must not be shared: dragging a node and retyping an
 * element's text. The relay is the authority (it drops guarded fields from anyone but the
 * holder); these hooks take the lock, keep it alive while the gesture lasts, and stop a gesture
 * from starting on something a peer already holds.
 */

/** Renew comfortably inside the lock's ttl. */
const RENEW_MS = Math.floor(LIMITS.lockTtlMs / 3);

/** Name of the peer holding a lock on `elementId`, or null. */
export function useLockedBy(elementId: string | null): string | null {
  return useCollabStore((state) => {
    if (!elementId) return null;
    const lock = state.locks[elementId];
    if (!lock) return null;
    const peer = state.session?.peers.find((p) => p.clientId === lock.holder);
    return peer?.user.name ?? lock.holder;
  });
}

function useLockLifecycle() {
  const { session, lockElement, renewElementLock, unlockElement } = useCollab();
  const held = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const release = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    for (const id of held.current) unlockElement(id);
    held.current.clear();
  }, [unlockElement]);

  const take = useCallback(
    (ids: string[]) => {
      if (!session) return;
      release();
      for (const id of ids) {
        held.current.add(id);
        lockElement(id);
      }
      timer.current = setInterval(() => {
        for (const id of held.current) renewElementLock(id);
      }, RENEW_MS);
    },
    [lockElement, release, renewElementLock, session],
  );

  useEffect(() => release, [release]);
  return { take, release, active: session !== null };
}

/** Drag locks for the canvas: nodes a peer holds cannot be dragged. */
export function useNodeDragLocks() {
  const locks = useCollabStore((state) => state.locks);
  const { take, release } = useLockLifecycle();

  const applyLocks = useCallback(
    <T extends Node>(nodes: T[]): T[] => {
      if (Object.keys(locks).length === 0) return nodes;
      return nodes.map((node) =>
        locks[node.id] && node.draggable !== false ? { ...node, draggable: false } : node,
      );
    },
    [locks],
  );

  const onNodeDragStart = useCallback(
    (_event: unknown, node: Node, dragged: Node[] = [node]) => {
      take(dragged.map((n) => n.id));
    },
    [take],
  );

  const onNodeDragStop = useCallback(() => release(), [release]);

  return useMemo(
    () => ({ applyLocks, onNodeDragStart, onNodeDragStop }),
    [applyLocks, onNodeDragStart, onNodeDragStop],
  );
}

/** Text-edit lock for one element's name and description fields. */
export function useElementTextLock(elementId: string | null) {
  const { take, release, active } = useLockLifecycle();
  const lockedBy = useLockedBy(elementId);
  const onFocus = useCallback(() => {
    if (elementId) take([elementId]);
  }, [elementId, take]);
  return { onFocus, onBlur: release, lockedBy: active ? lockedBy : null };
}
