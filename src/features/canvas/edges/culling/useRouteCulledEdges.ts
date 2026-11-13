import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore, type Edge, type ReactFlowState } from "@xyflow/react";
import {
  cullingWindow,
  sameIds,
  visibleEdgeIds,
  type Box,
  type CullableEdge,
} from "./routeCulling";

/** Below this many edges culling saves nothing worth its bookkeeping. */
export const EDGE_CULLING_MIN_EDGES = 200;

/**
 * How long the visible set must stay unchanged before edges that left it are
 * unmounted. During a pan or zoom the mounted set only grows: unmounting what
 * the last frame dropped, only to mount it again a frame later, is the most
 * expensive thing culling can do.
 */
export const EDGE_CULLING_RELEASE_MS = 400;

/** Ids in `visible` that are not mounted yet. */
function missingIds(mounted: Set<string>, visible: Set<string>): string[] {
  const missing: string[] = [];
  for (const id of visible) if (!mounted.has(id)) missing.push(id);
  return missing;
}

function withIds(set: Set<string>, ids: readonly string[]): Set<string> {
  const grown = new Set(set);
  for (const id of ids) grown.add(id);
  return grown;
}

interface CullCache {
  windowKey: string | null;
  zoomStep: number;
  nodes: ReactFlowState["nodes"] | null;
  edges: readonly Edge[] | null;
  ids: Set<string> | null;
}

/**
 * The edges to hand React Flow: those whose drawn route reaches the viewport
 * plus a margin (`routeCulling.ts`), selected ones and the playback step always.
 *
 * Runs as a single React Flow store selector for the whole canvas — never one
 * per edge (`canvas-hot-path.md` §6). The selector is memoised on the snapped
 * window, React Flow's node array and our edge array, so a pan frame that stays
 * inside its grid cell costs a comparison. The returned array keeps its
 * identity while the set of visible ids and the edges do not change, and the
 * edge objects are never copied, so the identity caches upstream still hold.
 *
 * Culling only decides what is *mounted*. Everything that acts on edges (select
 * all, delete, export, the store) works from the full list, never from this one.
 */
export function useRouteCulledEdges<E extends Edge>(edges: E[] | undefined): E[] | undefined {
  const cache = useRef<CullCache>({
    windowKey: null,
    zoomStep: 0,
    nodes: null,
    edges: null,
    ids: null,
  });
  const enabled = (edges?.length ?? 0) >= EDGE_CULLING_MIN_EDGES;

  const selector = useCallback(
    (s: ReactFlowState): Set<string> | null => {
      if (!enabled || !edges) return null;
      const window = cullingWindow(s.transform, s.width, s.height);
      if (!window) return null;
      const c = cache.current;
      if (c.ids && c.windowKey === window.key && c.nodes === s.nodes && c.edges === edges) {
        return c.ids;
      }
      const nodeBox = (id: string): Box | undefined => {
        const node = s.nodeLookup.get(id);
        if (!node) return undefined;
        const width = node.measured?.width ?? node.width;
        const height = node.measured?.height ?? node.height;
        if (width === undefined || height === undefined) return undefined;
        const { x, y } = node.internals.positionAbsolute;
        return { minX: x, minY: y, maxX: x + width, maxY: y + height };
      };
      const next = visibleEdgeIds(edges as readonly CullableEdge[], nodeBox, window);
      const ids = c.ids && sameIds(c.ids, next) ? c.ids : next;
      cache.current = {
        windowKey: window.key,
        zoomStep: window.zoomStep,
        nodes: s.nodes,
        edges,
        ids,
      };
      return ids;
    },
    [edges, enabled],
  );

  // The selector returns the same Set while the visible ids are unchanged.
  const visible = useStore(selector);

  // What is mounted: grows with `visible` in the same render, and shrinks back
  // to it once `visible` has held still for EDGE_CULLING_RELEASE_MS. Mounting
  // in batches over several frames was measured and was slower: every batch
  // pays React Flow's edge update and the line-hop recompute again.
  const [mounted, setMounted] = useState<Set<string> | null>(visible);
  // Zooming in shrinks the window: what it leaves behind is off screen and
  // tiny, and keeping it mounted made a zoom-in that crossed into full detail
  // render hundreds of off-screen edges in full. Release it at once.
  const zoomStep = cache.current.zoomStep;
  const previousZoomStep = useRef(zoomStep);
  const zoomingIn = zoomStep > previousZoomStep.current;
  previousZoomStep.current = zoomStep;
  let shown = mounted;
  if (!visible || !mounted || zoomingIn) {
    shown = visible;
  } else {
    const missing = missingIds(mounted, visible);
    if (missing.length > 0) shown = withIds(mounted, missing);
  }
  if (shown !== mounted) setMounted(shown);

  useEffect(() => {
    if (!visible || !mounted || visible === mounted) return;
    const timer = setTimeout(() => setMounted(visible), EDGE_CULLING_RELEASE_MS);
    return () => clearTimeout(timer);
  }, [visible, mounted]);

  return useMemo(() => {
    if (!edges || !shown) return edges;
    // `shown` can still hold ids of deleted edges, so compare the result, not sizes.
    const kept = edges.filter((edge) => shown.has(edge.id));
    return kept.length === edges.length ? edges : kept;
  }, [edges, shown]);
}
