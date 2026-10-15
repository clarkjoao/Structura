import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { EdgeLabelRenderer, useStore } from "@xyflow/react";

/**
 * One edge-label portal for the whole canvas.
 *
 * React Flow's `<EdgeLabelRenderer>` is a store subscriber whose selector is
 * `(s) => s.domNode?.querySelector('.react-flow__edgelabel-renderer')`. The
 * selector runs on every notification of the React Flow store, and the store is
 * notified on every frame of a drag, because `setNodes` replaces `nodes`.
 *
 * Structura mounted one of them per edge -- labels, toolbars, the collaboration
 * highlight and the playback payload overlay all rendered their own. Measured
 * on a 400-node / 439-edge diagram, that was 439 full `document.querySelector`
 * calls per drag frame and the single largest attributable cost of the gesture:
 * 291 ms of a 2.1 s drag, confirmed by stack attribution, not deduction.
 *
 * So the canvas mounts exactly one `<EdgeLabelRenderer>` (the host below) and
 * everything else portals into a container it owns.
 */
const EdgeLabelPortalContext = createContext<HTMLElement | null>(null);

/**
 * Owns the container element. It is created detached so an edge can portal into
 * it on its very first render; the host attaches it to the real renderer once
 * React Flow has one.
 */
export function EdgeLabelPortalProvider({ children }: { children: ReactNode }) {
  const [container] = useState<HTMLElement | null>(() =>
    typeof document === "undefined" ? null : document.createElement("div"),
  );
  return (
    <EdgeLabelPortalContext.Provider value={container}>{children}</EdgeLabelPortalContext.Provider>
  );
}

/** The container the canvas portals every edge label into. */
export function useEdgeLabelPortalContainer(): HTMLElement | null {
  return useContext(EdgeLabelPortalContext);
}

/**
 * Attach `container` when the mount node appears. Must be a ref callback, not a
 * mount-only effect: `<EdgeLabelRenderer>` often returns null on the host's
 * first paint (RF `domNode` not ready yet), then portals the mount on a later
 * store update without re-rendering the host. An effect keyed on `container`
 * would run once with `mount === null` and never attach — labels/toolbars stay
 * in a detached node and never show.
 */
function attachEdgeLabelContainer(mount: HTMLDivElement | null, container: HTMLElement | null) {
  if (!container) return;
  if (mount) {
    if (container.parentElement !== mount) mount.appendChild(container);
    return;
  }
  if (container.parentElement) container.remove();
}

/**
 * The single `<EdgeLabelRenderer>` of the canvas. Render it once, inside
 * `<ReactFlow>`, under an `EdgeLabelPortalProvider`.
 *
 * The container is a plain static div, so labels keep resolving their absolute
 * positions against `.react-flow__edgelabel-renderer` exactly as before, and it
 * sets no styles of its own, so the inherited `pointer-events: none` and the
 * per-label `pointer-events: auto` behave unchanged.
 */
export function EdgeLabelPortalHost() {
  const container = useEdgeLabelPortalContainer();
  /*
   * Stable identity, not an inline arrow: the host re-renders with the Canvas,
   * and React detaches a ref whose identity changed — calling the old callback
   * with null (which removes the container) and the new one with the mount
   * (which appends it again). That is two DOM mutations per render on the
   * element holding every edge label; the Canvas renders once per drag frame.
   * `container` never changes, so this is created once.
   */
  const attach = useCallback(
    (mount: HTMLDivElement | null) => attachEdgeLabelContainer(mount, container),
    [container],
  );

  return (
    <EdgeLabelRenderer>
      <div ref={attach} />
      <EdgeLabelZoomSync />
    </EdgeLabelRenderer>
  );
}

/** Below this zoom, edge labels hide unless their edge is revealed. */
export const EDGE_LABEL_MIN_ZOOM = 0.6;

/**
 * Edge labels live inside the zoomed viewport, so left alone they shrink with
 * it. Counter-scaling keeps them one size on screen, and below
 * `EDGE_LABEL_MIN_ZOOM` they would only crowd the diagram, so they hide.
 *
 * Both are written as a CSS variable and an attribute on the shared container,
 * from this one subscriber. A subscription per edge is what this file exists to
 * avoid (see the note at the top); a stylesheet rule reads the attribute.
 */
function EdgeLabelZoomSync() {
  const container = useEdgeLabelPortalContainer();
  const zoom = useStore((state) => state.transform[2]);
  useLayoutEffect(() => {
    if (!container) return;
    container.style.setProperty("--edge-label-scale", String(1 / zoom));
    container.dataset.labelsCollapsed = zoom < EDGE_LABEL_MIN_ZOOM ? "true" : "false";
  }, [container, zoom]);
  return null;
}

/** Drop-in replacement for `<EdgeLabelRenderer>` inside an edge component. */
export function EdgeLabelPortal({ children }: { children: ReactNode }) {
  const container = useEdgeLabelPortalContainer();
  if (!container) return null;
  return createPortal(children, container);
}
