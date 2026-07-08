## Context

`src/features/canvas/Canvas.tsx` mounts React Flow with a mixture of opinionated props and a custom wheel handler in `src/features/canvas/hooks/useCanvasEffects.ts`. The two paths run at the same time and disagree:

- React Flow: `panOnScroll` is `true`, `panOnScrollMode={PanOnScrollMode.Free}`, `zoomOnScroll={false}`, `zoomOnPinch`, `minZoom={0.3}`, `maxZoom={1.5}`.
- Custom handler: wheel without modifiers = vertical pan; Shift+wheel = horizontal pan; Cmd/Ctrl+wheel = zoom. The handler hard-codes `MAX_ZOOM = 1`, contradicting the React Flow `maxZoom` of 1.5.

`useCanvasInputProfile` (`src/features/canvas/hooks/useCanvasInputProfile.ts`) only reports `isTouchDevice`, `isCoarsePointer`, and `prefersTouchCanvasUi`. It does not distinguish a trackpad from a mouse, so the canvas treats them the same.

Panning on desktop today requires right-drag (`panOnDrag={[2]}`) or Cmd-drag (`panActivationKeyCode`). Middle-button drag does nothing. The `<Controls>` component is the only way to zoom without Cmd+wheel.

The custom handler zooms "in place" — `setViewport` keeps `x` and `y` the same and only multiplies `zoom`. This is what makes the canvas feel like it "jumps" after a zoom gesture: the world grows but the viewport stays anchored to (0, 0) instead of the cursor.

## Goals / Non-Goals

**Goals:**

- Trackpad and mouse get distinct, predictable behavior matching Figma / Excalidraw / draw.io.
- Wheel never fights with React Flow's own `panOnScroll`; one source of truth.
- Middle-button drag pans the canvas on desktop without removing left-drag selection or right-drag pan.
- Zoom centers on the cursor.
- The maximum zoom reachable via wheel matches what `<Controls>` advertises (`maxZoom={1.5}`).
- Existing pan/zoom stress Cypress tests still pass.

**Non-Goals:**

- No persistence of the user-chosen device mode; the canvas re-detects on each load.
- No new keyboard shortcuts (F, 0, Cmd+0) in this change.
- No auto-fit on Mermaid/Drawio import.
- No new Cypress tests in this change.
- No settings UI toggle for "trackpad mode".

## Decisions

- **Input detection uses the existing `useCanvasInputProfile` hook as the foundation**, extended with a `likelyTrackpad` boolean. The new signal is computed by sampling wheel events over a short rolling window: trackpad events have small, non-integer `deltaY` values and arrive in rapid bursts; mouse wheel events have large, integer `deltaY` values and arrive in single, isolated ticks. The fallback when no wheel events have been seen yet is `false` (mouse behavior), which is the safer default because no one is forced to fight a learned behavior they didn't yet engage.
- **The detection runs in a `useEffect` that attaches a non-passive `wheel` listener on the renderer** (alongside the existing handler) to count events and update the profile. The handler and the detector share the same listener when practical to avoid double-binding. The detector never calls `preventDefault`; it only observes.
- **The wheel handler branches on `inputProfile.likelyTrackpad`**:
  - Trackpad + plain wheel: pan (use both `deltaX` and `deltaY`, mapping `deltaY` to viewport `y` and `deltaX` to viewport `x`). Direction is kept consistent with the current "wheel down moves content down" behavior; the new code preserves the sign convention so the first wheel gesture after upgrade does not feel reversed.
  - Trackpad + Ctrl/Cmd key (pinch on most platforms emits a wheel event with `ctrlKey` true): zoom centered on cursor.
  - Mouse + plain wheel: zoom centered on cursor.
  - Shift+wheel (any device): horizontal pan (unchanged).
  - Cmd/Ctrl + wheel on a mouse: kept as a fallback for users who already learned it.
- **Cursor-centered zoom** uses the same math React Flow uses internally: given the cursor position in screen coordinates and the current viewport, compute the world point under the cursor, apply the new zoom, then shift the viewport so the same world point stays under the cursor. This is the standard "zoom-to-cursor" algorithm and prevents the perceived jump.
- **`MAX_ZOOM` is removed from the local handler and sourced from `canvas.constants.ts`** (or a new `WHEEL_MAX_ZOOM` constant there) so it cannot drift from the `<ReactFlow maxZoom>` prop. The constant is set to `1.5` to match the prop.
- **React Flow's `panOnScroll` is set to `false` explicitly** to remove the dual-handler race. React Flow's `zoomOnPinch` stays enabled so trackpad pinch works at the React Flow level too; the custom handler still wins for the wheel-with-ctrl event because it calls `preventDefault`. If we discover in implementation that the two still conflict, the fallback is to set `zoomOnPinch={false}` and implement pinch detection ourselves in the wheel handler via `ctrlKey` (which is the standard browser convention for synthesized pinch events).
- **Middle-button pan** is implemented in `useCanvasEventHandlers.ts` by handling `onPointerDown` with `e.button === 1` on the pane: capture the pointer, set a `panOnDrag`-like local mode, and translate pointer movement into `setViewport` calls. We avoid mutating React Flow's `panOnDrag` because that would also need a corresponding `panOnDrag={[1, 2]}` for the whole canvas, which is broader than the change intends. The implementation guards on `nodesDraggable` being true and on the active interaction mode allowing canvas pan.
- **No changes to touch behavior**: the `prefersTouchCanvasUi` branch of `useCanvasInputProfile` already drives the right React Flow props for touch (`panOnDrag={true}`, `selectionOnDrag={false}`). The new "likely trackpad" flag is only consulted when `prefersTouchCanvasUi` is false, so touch devices and styluses are unaffected.
- **The `<Controls>` zoom buttons still use React Flow's built-in path** (no change). Their zoom is also cursor-centered by React Flow itself, so once the custom handler and React Flow agree on `maxZoom`, the two paths will produce consistent results.

## Risks / Trade-offs

- **[Heuristic misclassification]** A user with a high-resolution mouse or an unusual trackpad might be detected as the wrong device class, and the wrong default fires. *Mitigation*: the heuristic starts as "mouse" and only flips to "trackpad" after multiple small-delta events in a short window, so a one-off wheel tick on a mouse never triggers trackpad mode. A "reset to mouse" path is not exposed in this change but is a small follow-up if it becomes necessary.
- **[First-trackpad-gesture feels reversed]** Trackpads emit `deltaY > 0` for a downward two-finger swipe, which traditionally means "scroll content up". The current code inverts this so that content moves with the fingers. The new code keeps the same sign convention so users who already learned the inversion keep their muscle memory. *Mitigation*: leave the inversion in; document it in a follow-up only if user feedback asks for it.
- **[Middle-button drag interferes with browser autoscroll or back navigation]** The middle button is a reserved browser gesture on some platforms. *Mitigation*: call `e.preventDefault()` on `pointerdown` for the middle button before the capture starts, and rely on the React Flow pane element being inside a container that has its own `pointer-events: auto` so the browser default is suppressed.
- **[Two wheel listeners]** We end up with one listener that observes events for detection and one that consumes them for pan/zoom. The detect-only listener must be added with `{ passive: true }` and `preventDefault` never called, so it cannot regress wheel behavior. *Mitigation*: share a single listener by calling the detector from inside the main handler; this is the preferred shape and avoids the duplication.
- **[MAX_ZOOM change is observable]** A canvas that was previously capped at 100% will now allow up to 150% via wheel, matching the `<Controls>` buttons. A user who was relying on the implicit cap will see different behavior. *Mitigation*: this is the intended fix for "the buttons promise something the wheel can't deliver", but it is called out so reviewers can confirm.
- **[Inversion of mouse default]** Mouse users who learned "wheel pans" will need to retrain. *Mitigation*: the Stress tests use `<Controls>` zoom buttons (still work) and right-drag pan (unchanged); no test depends on "wheel pans". Manual smoke covers the regression.

## Migration Plan

Single PR on `feat/ux-002-canvas-zoom` (off `main`):

1. Extend `useCanvasInputProfile` with the trackpad detection (`likelyTrackpad`) without changing the existing fields.
2. Replace the wheel handler in `useCanvasEffects.ts` with the branching handler (trackpad vs mouse) and the cursor-centered zoom math.
3. Set `panOnScroll={false}` on `<ReactFlow>` to remove the dual-handler race.
4. Move `MAX_ZOOM` to a shared constant in `canvas.constants.ts` and align it with `1.5`.
5. Add middle-button pan handling in `useCanvasEventHandlers.ts`.
6. Run `npm run typecheck`, `npm run lint`, `npm run format`, `npm run test`, and the existing `cy:run:stress` suite to confirm no regression in pan / fit / zoom-control stress tests.
7. Manual smoke on mouse and trackpad (or two computers) before merge.

Rollback: revert the single commit. No schema, persistence, or migration concerns. The `<ReactFlow maxZoom={1.5}>` prop was already in main, so re-aligning the handler constant is a no-op for persisted diagrams.

## Open Questions

- **Should we keep the mouse default as "wheel = zoom" or expose a settings toggle?** Currently planned: no toggle, mouse default is "wheel = zoom", and a one-line "fit-to-cursor" revert path is left as a follow-up if needed.
- **Should `zoomOnPinch` be left on or off?** Planned: left on. If the dual-handler race reappears during implementation, the fallback is to turn it off and synthesize pinch detection via `ctrlKey` in the custom handler.
- **Should middle-button pan also be available on touch?** Planned: no. Touch already pans via React Flow's `panOnDrag={true}`. Adding another path on touch is unnecessary and risks conflicting with selection gestures.
