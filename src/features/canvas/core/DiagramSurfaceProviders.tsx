import type { ReactNode } from "react";
import { CanvasLodProvider } from "../contexts/CanvasLodContext";
import { ElementsSelectableProvider } from "../contexts/ElementsSelectableContext";
import { LineHopsProvider } from "../contexts/LineHopsContext";
import { ReadingDirectionContext } from "../contexts/ReadingDirectionContext";
import { EdgeLabelPortalProvider } from "../edges/EdgeLabelPortal";
import type { ReadingDirection } from "../nodes/node-types/handle-sides";
import type { DragActivity } from "../components/miniMapDragThrottle";

/**
 * Every context a diagram surface gives its nodes and edges, in one place.
 * They wrap `<ReactFlow>`, not sit inside it: nodes and edges are rendered by
 * React Flow's own renderer, so a child of `<ReactFlow>` is their sibling.
 *
 * One provider, several contexts — on purpose. Each value lives in a context
 * of its own so a consumer re-renders only for the value it reads: the line
 * hops registry, the label portal and the level-of-detail setter never change;
 * the level of detail changes once per zoom threshold; selectability and the
 * reading direction change with the mode and the diagram. One context object
 * holding them all would re-render every edge whenever any of them moved
 * (canvas-hot-path.md, §5b).
 */
export function DiagramSurfaceProviders({
  elementsSelectable,
  readingDirection,
  dragActivity,
  children,
}: {
  elementsSelectable: boolean;
  readingDirection: ReadingDirection;
  /** A node drag in progress on this surface; line hops follow it on a timer. */
  dragActivity?: DragActivity;
  children: ReactNode;
}) {
  return (
    <ElementsSelectableProvider value={elementsSelectable}>
      <LineHopsProvider dragActivity={dragActivity}>
        <CanvasLodProvider>
          <ReadingDirectionContext.Provider value={readingDirection}>
            <EdgeLabelPortalProvider>{children}</EdgeLabelPortalProvider>
          </ReadingDirectionContext.Provider>
        </CanvasLodProvider>
      </LineHopsProvider>
    </ElementsSelectableProvider>
  );
}
