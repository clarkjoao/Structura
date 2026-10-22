import type { Point } from "@/features/diagram";
import { findLineHops, type LineHop } from "./geometry/lineHops";

/**
 * The edges on one canvas, and where each one hops over another.
 *
 * A hop depends on every other edge, but an edge component only knows its own
 * path. So each step edge publishes its path here, one recompute runs per
 * animation frame however many edges published in it, and each edge subscribes
 * to its own hops only: an edge re-renders when *its* hops change, never
 * because some other edge moved. That is what keeps this off the drag-frame
 * budget in `docs/concepts/canvas-hot-path.md` — no per-edge store
 * subscription to a canvas-wide value, no walk of all edges per edge.
 */
export interface LineHopsRegistry {
  publish(id: string, points: readonly Point[]): void;
  remove(id: string): void;
  subscribe(id: string, listener: () => void): () => void;
  getHops(id: string): readonly LineHop[];
}

export const NO_LINE_HOPS: readonly LineHop[] = Object.freeze([]);

type Schedule = (run: () => void) => void;

const nextFrame: Schedule = (run) => {
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(run);
  else setTimeout(run, 0);
};

function sameHops(a: readonly LineHop[], b: readonly LineHop[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const p = a[i]!;
    const q = b[i]!;
    if (p.segIndex !== q.segIndex || p.x !== q.x || p.y !== q.y) return false;
  }
  return true;
}

/** @param schedule when to recompute after a change; tests pass a synchronous one. */
export function createLineHopsRegistry(schedule: Schedule = nextFrame): LineHopsRegistry {
  const paths = new Map<string, readonly Point[]>();
  let hops = new Map<string, readonly LineHop[]>();
  const listeners = new Map<string, Set<() => void>>();
  let pending = false;

  const recompute = () => {
    pending = false;
    const next = findLineHops([...paths].map(([id, points]) => ({ id, points })));
    const changed: string[] = [];
    const settled = new Map<string, readonly LineHop[]>();

    for (const [id, list] of next) {
      const previous = hops.get(id);
      // Keep the previous array when nothing moved, so the snapshot is stable.
      if (previous && sameHops(previous, list)) settled.set(id, previous);
      else {
        settled.set(id, list);
        changed.push(id);
      }
    }
    for (const id of hops.keys()) if (!next.has(id)) changed.push(id);

    hops = settled;
    for (const id of changed) listeners.get(id)?.forEach((listener) => listener());
  };

  const invalidate = () => {
    if (pending) return;
    pending = true;
    schedule(recompute);
  };

  return {
    publish(id, points) {
      if (paths.get(id) === points) return;
      paths.set(id, points);
      invalidate();
    },
    remove(id) {
      if (!paths.delete(id)) return;
      invalidate();
    },
    subscribe(id, listener) {
      let set = listeners.get(id);
      if (!set) {
        set = new Set();
        listeners.set(id, set);
      }
      set.add(listener);
      return () => {
        set.delete(listener);
        if (set.size === 0) listeners.delete(id);
      };
    },
    getHops(id) {
      return hops.get(id) ?? NO_LINE_HOPS;
    },
  };
}
