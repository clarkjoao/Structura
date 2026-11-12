/**
 * How often the minimap follows the canvas while nodes are dragged. At rest it
 * follows every change, as React Flow's own minimap does.
 */
export const MINIMAP_DRAG_REFRESH_MS = 200;

/** Whether a node drag is in progress on one canvas. Written by the canvas drag handlers. */
export interface DragActivity {
  isDragging(): boolean;
  start(): void;
  stop(): void;
  subscribe(listener: () => void): () => void;
}

export function createDragActivity(): DragActivity {
  let dragging = false;
  const listeners = new Set<() => void>();
  const set = (next: boolean) => {
    if (next === dragging) return;
    dragging = next;
    listeners.forEach((listener) => listener());
  };
  return {
    isDragging: () => dragging,
    start: () => set(true),
    stop: () => set(false),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

interface Timers {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

const browserTimers: Timers = {
  setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export interface DragThrottle {
  /** The source changed: pass it on now at rest, at most once per interval while dragging. */
  sourceChanged(): void;
  dispose(): void;
}

/**
 * Passes source changes on to `push`. At rest every change goes through at
 * once. While a drag is in progress changes are held and pushed at most once
 * every `intervalMs`, and whatever is still held is pushed the moment the drag
 * ends, so the last frame of a gesture is never lost.
 */
export function createDragThrottle(
  push: () => void,
  activity: DragActivity,
  intervalMs: number = MINIMAP_DRAG_REFRESH_MS,
  timers: Timers = browserTimers,
): DragThrottle {
  let pending = false;
  let timer: unknown = null;

  const cancelTimer = () => {
    if (timer === null) return;
    timers.clearTimeout(timer);
    timer = null;
  };
  const flush = () => {
    cancelTimer();
    if (!pending) return;
    pending = false;
    push();
  };

  const unsubscribe = activity.subscribe(() => {
    if (!activity.isDragging()) flush();
  });

  return {
    sourceChanged() {
      pending = true;
      if (!activity.isDragging()) {
        flush();
        return;
      }
      if (timer === null) {
        timer = timers.setTimeout(() => {
          timer = null;
          flush();
        }, intervalMs);
      }
    },
    dispose() {
      unsubscribe();
      cancelTimer();
      pending = false;
    },
  };
}
