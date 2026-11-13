import { useLayoutEffect } from "react";
import { MiniMap, ReactFlowProvider, useStoreApi, type MiniMapProps } from "@xyflow/react";
import { createDragThrottle, type DragActivity } from "./miniMapDragThrottle";

type SourceStore = ReturnType<typeof useStoreApi>;

/**
 * React Flow's `<MiniMap>`, following the canvas less often while nodes are
 * dragged.
 *
 * The minimap subscribes to React Flow's store itself: on every drag frame it
 * recomputes the bounds of every node, re-reads every node's box and redraws
 * every moved rectangle (all of them when the whole selection moves). Here it
 * reads a mirror of that store instead — its own `ReactFlowProvider`, handed
 * the canvas store's state object as is. At rest every change reaches the
 * mirror at once, so panning, zooming and clicking the minimap behave exactly
 * as before; during a drag the mirror is refreshed every
 * `MINIMAP_DRAG_REFRESH_MS` and once more when the drag ends.
 */
export function DragThrottledMiniMap({
  dragActivity,
  ...props
}: MiniMapProps & { dragActivity: DragActivity }) {
  const source = useStoreApi();
  return (
    <ReactFlowProvider>
      <MirrorOf source={source} dragActivity={dragActivity} />
      <MiniMap {...props} />
    </ReactFlowProvider>
  );
}

/** Keeps the enclosing provider's store a copy of `source`. Rendered before the minimap, so its first layout effect runs before the minimap paints. */
function MirrorOf({ source, dragActivity }: { source: SourceStore; dragActivity: DragActivity }) {
  const mirror = useStoreApi();
  useLayoutEffect(() => {
    // The state object itself, not a copy: selectors see the same snapshot the canvas does.
    const push = () => mirror.setState(source.getState(), true);
    push();
    const throttle = createDragThrottle(push, dragActivity);
    const unsubscribe = source.subscribe(throttle.sourceChanged);
    return () => {
      unsubscribe();
      throttle.dispose();
    };
  }, [mirror, source, dragActivity]);
  return null;
}
