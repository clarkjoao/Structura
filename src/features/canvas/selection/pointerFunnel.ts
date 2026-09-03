/**
 * Selection epic — Phase 4: pointer-event precedence funnel.
 *
 * Why a funnel and not scattered handlers: with three sources of selection
 * truth (React Flow internal, `useCanvasSelectionStore`, `useLocalNodes`
 * refs) and 85 `stopPropagation` calls in `features/canvas`, every gesture
 * fix risked regressing via another handler path. The funnel is the single
 * owner of "what gesture did the user just start?" — handlers in
 * `useCanvasEventHandlers.ts` are now thin adapters that ask the funnel.
 *
 * Precedence chain (first match wins, no silent fall-through):
 *
 *   1. Right button (`button === 2`)
 *      - distance < `DRAG_THRESHOLD_PX`  →  `context-menu`  (open on release)
 *      - distance ≥ `DRAG_THRESHOLD_PX`  →  `pan`; no menu on release
 *      - Cancels any in-flight left-button gesture.
 *
 *      Decision #8: a right-drag pans from ANYWHERE on the canvas, nodes and
 *      panels included. Two mechanisms deliver that, and which one runs is
 *      decided once, at pointerdown, so they can never both move the viewport
 *      for the same gesture:
 *
 *        - press outside `.nopan`  →  d3-zoom pans, via `panOnDrag=[1, 2]`.
 *          The funnel does nothing but withhold the menu.
 *        - press inside `.nopan`   →  d3-zoom's filter refuses the gesture
 *          outright, so the funnel pans, by translating the viewport by the
 *          pointer delta (`panViewportBy` below).
 *
 *      `.react-flow__node` carries `nopan`, which is why the second branch
 *      exists at all. React Flow's own filter has no button-scoped hook — it
 *      hardcodes one early return for the MIDDLE button over nodes and edges
 *      (`createFilter` in `@xyflow/system`), and nothing equivalent for the
 *      right button. The only prop that reaches it, `noPanClassName`, is
 *      global: renaming the class re-enables pan over every text field,
 *      slider and quick-action bar inside a node too. Owning the small branch
 *      here is the narrower change.
 *
 *   2. Middle button (`button === 1`)  →  `pan`  (RF handles via `panOnDrag=[1,2]`).
 *
 *   3. Left button (`button === 0`)
 *      - Connection in progress  →  `connect`.
 *      - Marquee in progress (`userSelectionActive`)  →  `marquee`.
 *      - Pane  →  if `selectionOnDrag`, `marquee`; else `click`.
 *      - Panel header  →  `drag` (move panel).
 *      - Panel border (within 8 px of the outer edge)  →  `drag`. Both the
 *        header and the ring are named in `dragHandle` on the panel
 *        descriptor, which is what actually lets React Flow start the move.
 *      - Panel body  →  background. The press is forwarded to the pane by
 *        `PanelNode` so React Flow arms its marquee; a release under the
 *        threshold clears the selection through `onBackgroundClick` below.
 *      - Node (non-panel)  →  `click` + drag-replace / shift-add.
 *
 *   4. Space-held `pointerdown` on the pane  →  `pan`.
 *
 * The funnel does NOT replace React Flow's drag layer — RF still owns the
 * actual position update for node drags. The funnel only decides which
 * gesture starts and which store writes happen on `pointerdown` (so we beat
 * RF's `onClick` round-trip in the race for selection).
 */

import { useEffect, useRef } from "react";
import { DRAG_THRESHOLD_PX, DRAG_THRESHOLD_PX_SQUARED } from "./dragThreshold";
import { useCanvasSelectionStore } from "../hooks/useCanvasSelectionStore";
import { dragSelectionRef } from "../hooks/useLocalNodes";

/** Target resolution for a pointer event. */
export type GestureTarget =
  | { kind: "panel-header"; nodeId: string }
  | { kind: "panel-border"; nodeId: string }
  | { kind: "panel-body"; nodeId: string }
  | { kind: "node"; nodeId: string }
  | { kind: "pane"; atScreen: { x: number; y: number } };

/** What the funnel decided the gesture is. */
export type Gesture = "click" | "drag" | "marquee" | "pan" | "context-menu" | "connect";

export interface GestureResolve {
  gesture: Gesture;
  target: GestureTarget;
  /** True when the funnel has already written selection state on pointerdown. */
  consumedSelection: boolean;
}

/**
 * Selector panel parts the funnel looks for in the DOM. RF does not surface
 * a typed handle on the node element for "this part is the header" — we
 * tag them with data attributes / class names and read them back here.
 */
const SELECTOR_PANEL_HEADER = ".panel-header";
const SELECTOR_PANEL_BORDER = ".panel-border";
const SELECTOR_PANEL_BODY = ".panel-body";
const SELECTOR_NODE = ".react-flow__node";
const SELECTOR_PANE = ".react-flow__pane";

/**
 * Resolve what the pointer is over by walking up from `event.target`. The
 * DOM contains the panel header / body / border / node / pane in a single
 * tree; walking up gives us the most-specific hit.
 */
function resolveTarget(event: PointerEvent | MouseEvent | React.PointerEvent): GestureTarget | null {
  const el = event.target as Element | null;
  if (!el) return null;
  const closest = el.closest?.bind(el) as (selector: string) => Element | null;

  // Order matters: most specific first. The panel-header / panel-body /
  // panel-border all live INSIDE a `.react-flow__node`, so we check them
  // before the generic node selector.
  const header = closest(SELECTOR_PANEL_HEADER);
  if (header) {
    const nodeEl = header.closest(SELECTOR_NODE) as HTMLElement | null;
    const nodeId = nodeEl?.getAttribute("data-id");
    if (nodeId) return { kind: "panel-header", nodeId };
  }
  const border = closest(SELECTOR_PANEL_BORDER);
  if (border) {
    const nodeEl = border.closest(SELECTOR_NODE) as HTMLElement | null;
    const nodeId = nodeEl?.getAttribute("data-id");
    if (nodeId) return { kind: "panel-border", nodeId };
  }
  const body = closest(SELECTOR_PANEL_BODY);
  if (body) {
    const nodeEl = body.closest(SELECTOR_NODE) as HTMLElement | null;
    const nodeId = nodeEl?.getAttribute("data-id");
    if (nodeId) return { kind: "panel-body", nodeId };
  }
  const node = closest(SELECTOR_NODE);
  if (node) {
    const nodeId = (node as HTMLElement).getAttribute("data-id");
    if (nodeId) return { kind: "node", nodeId };
  }
  if (closest(SELECTOR_PANE)) {
    return { kind: "pane", atScreen: { x: event.clientX, y: event.clientY } };
  }
  return null;
}

interface InFlightGesture {
  button: number;
  startX: number;
  startY: number;
  target: GestureTarget;
  selectionWritten: boolean;
  /**
   * True when this press landed somewhere d3-zoom's filter refuses, so the
   * funnel — not React Flow — owns the pan for this gesture. Decided once, on
   * pointerdown, and never re-evaluated: that is what keeps the two pan paths
   * from both moving the viewport.
   */
  funnelOwnsPan: boolean;
  /** Set once the gesture crosses `DRAG_THRESHOLD_PX` and the pan begins. */
  panning: boolean;
  /** Pointer position the last pan delta was measured from. */
  lastX: number;
  lastY: number;
}

/**
 * React Flow's `noPanClassName`, at its default. The app does not override the
 * prop, so the literal is correct; `createFilter` in `@xyflow/system` bails on
 * `event.target.closest('.nopan')` for every non-wheel event, with no
 * per-button exception for button 2.
 */
const NO_PAN_CLASS = "nopan";

/** Gesture targets that sit inside a `.nopan` node — the ones d3 refuses. */
const PAN_TARGETS_INSIDE_NOPAN: ReadonlySet<GestureTarget["kind"]> = new Set([
  "node",
  "panel-header",
  "panel-border",
  "panel-body",
]);

/**
 * React hook that wires the funnel into the page. Registers on `window` with
 * `capture: true` so the funnel runs before every React Flow listener —
 * including d3-zoom's own window-capture `mouseup`, which ends a pan with
 * `stopImmediatePropagation`. The hook returns a `cancel` callback
 * the Esc handler can invoke (decision #5).
 */
export function usePointerFunnel(params: {
  /** Called when the funnel decides a right-button press should open a menu. */
  openContextMenu?: (target: GestureTarget, atScreen: { x: number; y: number }) => void;
  /** Called when a left-button press on a node writes selection on pointerdown. */
  onNodePointerDown?: (nodeId: string, shiftKey: boolean) => void;
  /**
   * Decision #1, second half — called on the release of a sub-threshold
   * left click on a panel BODY, which is a background click by definition.
   * Wired to the same `clearCanvasSelection` the pane click uses, so
   * "click the interior" and "click the canvas" clear identically.
   */
  onBackgroundClick?: () => void;
  /**
   * Decision #8 — translate the viewport by a pointer delta, in screen px.
   * Only called for right-button drags that started inside `.nopan`, i.e. the
   * ones d3-zoom declined; everywhere else React Flow pans and this stays
   * untouched.
   */
  panViewportBy?: (dx: number, dy: number) => void;
  /** True when the canvas is read-only (compare / flow playback / focus). */
  selectionDisabled?: boolean;
}) {
  const inFlightRef = useRef<InFlightGesture | null>(null);
  const consumedClickByNodeRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (typeof document === "undefined") return;

    const onPointerDown = (event: PointerEvent | MouseEvent) => {
      const target = resolveTarget(event);
      if (!target) return;

      // Track every press (any button) so we can decide on pointerup whether
      // it stayed under the threshold.
      //
      // `funnelOwnsPan` is settled here and only here (decision #8). A right
      // press on a node or a panel is a press inside `.nopan`, which d3-zoom's
      // filter rejects, so this funnel has to move the viewport itself. A
      // right press anywhere else reaches d3 and React Flow pans — the funnel
      // must then keep its hands off, or the viewport would move twice per
      // pointer delta.
      const targetEl = event.target as Element | null;
      const insideNoPan = Boolean(targetEl?.closest?.(`.${NO_PAN_CLASS}`));
      inFlightRef.current = {
        button: event.button,
        startX: event.clientX,
        startY: event.clientY,
        target,
        selectionWritten: false,
        funnelOwnsPan:
          event.button === 2 && insideNoPan && PAN_TARGETS_INSIDE_NOPAN.has(target.kind),
        panning: false,
        lastX: event.clientX,
        lastY: event.clientY,
      };

      // Decision #3 — left-button pointerdown on a node writes selection
      // BEFORE React Flow's `onClick` round-trip. Shift adds; unselected
      // while others are selected replaces the selection with just this node.
      //
      // Decision #1 — left-button pointerdown on a panel BODY does NOT write
      // selection. We still mark the click as consumed so React Flow's
      // `onNodeClick` early-returns (otherwise RF would treat the click as
      // a hit on the parent panel and select it). This is what gives the
      // panel body "click goes through to the pane" semantics — body click
      // falls through, body drag (via `dragHandle` on `.panel-header`) starts
      // a marquee.
      if (event.button === 0) {
        if (target.kind === "panel-body") {
          consumedClickByNodeRef.current.set(target.nodeId, performance.now());
          inFlightRef.current.selectionWritten = false;
          return;
        }
        if (
          target.kind === "node" ||
          target.kind === "panel-header" ||
          target.kind === "panel-border"
        ) {
          const store = useCanvasSelectionStore.getState();
          const selectedNodeIds = store.selectedNodeIds;
          const nodeId = target.nodeId;

          if (event.shiftKey) {
            // Shift adds (toggle if already present). We also keep the
            // mark so React Flow's mousedown path can be aware — but the
            // primary effect here is that on a real Shift+keydown
            // (multiSelectionActive=true in RF), RF's `handleNodeClick`
            // does the toggle correctly. The synthetic Cypress path uses
            // a keydown before the mousedown to reach the same state.
            const next = new Set(selectedNodeIds);
            if (next.has(nodeId)) next.delete(nodeId);
            else next.add(nodeId);
            store.setSelectedNodeIds(next);
            store.setSelectedNodeId(next.values().next().value ?? null);
            inFlightRef.current.selectionWritten = true;
            consumedClickByNodeRef.current.set(nodeId, performance.now());
            params.onNodePointerDown?.(nodeId, true);
          } else if (!selectedNodeIds.has(nodeId) && selectedNodeIds.size > 0) {
            // Replace half: unselected node dragged/clicked while others are selected.
            store.setSelectedNodeIds(new Set([nodeId]));
            store.setSelectedNodeId(nodeId);
            inFlightRef.current.selectionWritten = true;
            consumedClickByNodeRef.current.set(nodeId, performance.now());
            params.onNodePointerDown?.(nodeId, false);
          }
        }
      }
    };

    /**
     * Decision #8 — the funnel-owned half of right-button pan.
     *
     * Registered for BOTH `pointermove` and `mousemove` because real browsers
     * fire pointer events while Cypress's synthetic gestures only fire mouse
     * ones. That double delivery is safe here specifically because the pan is
     * expressed as a delta from the last position: the compatibility
     * `mousemove` that trails a `pointermove` carries identical coordinates,
     * so it computes a zero delta and moves nothing. An absolute formulation
     * would have panned twice per frame.
     */
    const onPointerMove = (event: PointerEvent | MouseEvent) => {
      const inFlight = inFlightRef.current;
      if (!inFlight || !inFlight.funnelOwnsPan) return;

      if (!inFlight.panning) {
        // Same gate as the context menu, from the same start point: under the
        // threshold this is still a click that will open a menu on release.
        const dx = event.clientX - inFlight.startX;
        const dy = event.clientY - inFlight.startY;
        if (dx * dx + dy * dy < DRAG_THRESHOLD_PX_SQUARED) return;
        inFlight.panning = true;
        // Pan from the press point, not from here, so crossing the threshold
        // does not silently swallow the first few pixels of the gesture.
        inFlight.lastX = inFlight.startX;
        inFlight.lastY = inFlight.startY;
      }

      const dx = event.clientX - inFlight.lastX;
      const dy = event.clientY - inFlight.lastY;
      if (dx === 0 && dy === 0) return;
      inFlight.lastX = event.clientX;
      inFlight.lastY = event.clientY;
      params.panViewportBy?.(dx, dy);
    };

    const onPointerUp = (event: PointerEvent | MouseEvent) => {
      const inFlight = inFlightRef.current;
      inFlightRef.current = null;
      if (!inFlight) return;
      if (inFlight.button !== event.button) return;

      const dx = event.clientX - inFlight.startX;
      const dy = event.clientY - inFlight.startY;
      const isDrag = dx * dx + dy * dy >= DRAG_THRESHOLD_PX_SQUARED;

      // Right-button release: short press opens menu, long press is pan (handled by RF).
      if (inFlight.button === 2) {
        if (!isDrag) {
          params.openContextMenu?.(inFlight.target, { x: event.clientX, y: event.clientY });
        }
        return;
      }

      // Decision #1 — a left click that starts AND ends inside a panel body,
      // without crossing the drag threshold, is a background click: it clears
      // the selection exactly like a click on the pane.
      //
      // Why this lives here and not on the `.panel-body` element: with
      // `selectionOnDrag` on, React Flow gives the pane no `onClick` at all
      // (`onClick: isSelectionEnabled ? undefined : ...` in its `Pane`), and
      // routes the pane click through `onPointerUp` gated on
      // `event.target === container.current`. A release over the panel body
      // fails that gate, so React Flow will never clear for us. Measured
      // before this branch existed: interior click with the panel selected
      // left the panel selected — decision #1 held for "does not select" and
      // failed for "clears", which is the half the product owner actually
      // complained about ("ao selecionar o fundo, não é desselecionado").
      //
      // Modifier-held clicks are excluded: shift/ctrl/meta on the body is an
      // additive gesture in progress, not a request to drop the selection.
      if (
        inFlight.button === 0 &&
        !isDrag &&
        inFlight.target.kind === "panel-body" &&
        !event.shiftKey &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        params.onBackgroundClick?.();
      }
    };

    // Capture phase on `window`, not on `document`, and this is load-bearing.
    //
    // React Flow pans through d3-zoom. On `mousedown` d3 registers
    // `mousemove.zoom` / `mouseup.zoom` on `event.view` — the window — with
    // `capture: true`, and its `mouseupped` ends the gesture with d3's
    // `noevent()`, i.e. `preventDefault() + stopImmediatePropagation()`.
    // Window-capture is the FIRST hop of propagation, so a funnel listening on
    // `document` never saw the release of any gesture d3 had claimed: on the
    // pane the right-button `mouseup` died at the window and the funnel's
    // threshold gate simply never ran.
    //
    // Listening on the window instead puts the funnel ahead of d3 for the same
    // target and phase, because `stopImmediatePropagation` only silences
    // listeners registered AFTER the one that calls it, and the funnel
    // registers on mount while d3 registers on each `mousedown`.
    //
    // Listen to BOTH pointerdown and mousedown: real browsers fire pointer
    // events, but Cypress's `cy.get(...).click()` only fires mousedown.
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("mousedown", onPointerDown, true);
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("mousemove", onPointerMove, true);
    window.addEventListener("pointerup", onPointerUp, true);
    window.addEventListener("mouseup", onPointerUp, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("mousedown", onPointerDown, true);
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("mousemove", onPointerMove, true);
      window.removeEventListener("pointerup", onPointerUp, true);
      window.removeEventListener("mouseup", onPointerUp, true);
    };
  }, [params]);

  return {
    /**
     * Returns true if the funnel wrote selection state for this node on
     * pointerdown — used by `onNodeClick` to early-return so it does not
     * undo the funnel's write. The flag auto-expires after a short window
     * so unrelated later clicks are not affected.
     */
    consumedClick: (nodeId: string): boolean => {
      const t = consumedClickByNodeRef.current.get(nodeId);
      if (t == null) return false;
      if (performance.now() - t > 500) {
        consumedClickByNodeRef.current.delete(nodeId);
        return false;
      }
      return true;
    },
    /** Decision #5 — Esc layered precedence: cancel in-progress gesture. */
    cancelInFlightGesture: (): boolean => {
      const wasInFlight = inFlightRef.current != null;
      inFlightRef.current = null;
      return wasInFlight;
    },
    /** Exposed for tests + manual scripts; matches `dragThreshold.DRAG_THRESHOLD_PX`. */
    threshold: DRAG_THRESHOLD_PX,
  };
}

/**
 * Lightweight helper for callers that just need the resolve without
 * subscribing to pointer events. Useful for the panel-body click handler
 * that wants to decide "does this click select the panel?".
 */
export function shouldBodyClickSelect(): boolean {
  // Decision #1: body never selects. The function exists as a hook-point
  // for future cases (e.g. body inside an editable mode) and so callers
  // import a single source of truth instead of inlining the answer.
  return false;
}

// Re-export the drag-selection ref so the funnel can clear it cleanly on
// pointerup of a non-drag gesture — the existing event handler still reads
// it. Keeping the import here documents that the funnel and `useLocalNodes`
// cooperate on `dragSelectionRef`.
export { dragSelectionRef };
