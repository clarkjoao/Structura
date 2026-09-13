import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { EdgeLabelRenderer } from "@xyflow/react";

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
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!container || !mount) return;
    mount.appendChild(container);
    return () => {
      container.remove();
    };
  }, [container]);

  return (
    <EdgeLabelRenderer>
      <div ref={mountRef} />
    </EdgeLabelRenderer>
  );
}

/** Drop-in replacement for `<EdgeLabelRenderer>` inside an edge component. */
export function EdgeLabelPortal({ children }: { children: ReactNode }) {
  const container = useEdgeLabelPortalContainer();
  if (!container) return null;
  return createPortal(children, container);
}
