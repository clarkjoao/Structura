## Why

The canvas today has a single, fixed navigation model that confuses both mouse and trackpad users:

- Wheel always pans vertically, even on a trackpad where two-finger scroll expects to feel like a pan and a pinch expects to feel like a zoom. This is the opposite of what Figma, Excalidraw, draw.io, and most diagramming tools do.
- Zoom on mouse requires holding Cmd/Ctrl while scrolling, which is undiscoverable and uncomfortable. Trackpad pinch is enabled but is treated identically to wheel-with-modifier, ignoring the natural gesture.
- Pan on a desktop mouse requires right-click drag or Cmd+drag — discoverable only by accident. Middle-button pan (the universal default in design tools) is not supported.
- The custom wheel handler in `useCanvasEffects.ts` and React Flow's own `panOnScroll` are both enabled, so behavior depends on which one wins the race; this is a source of the "unexpected jumps" users report.
- The custom handler hard-codes `MAX_ZOOM = 1` even though `<ReactFlow maxZoom={1.5}>` advertises 150%, so the UI promises zoom the keyboard/buttons can't actually deliver.

The result is a navigation experience that is unpredictable per device and pushes users toward the "Fit to View" button after every gesture, which is a sign of the wrong defaults, not a missing feature.

## What Changes

- **Detect input device class** (trackpad vs mouse) at the canvas level. A coarse pointer or repeated small `deltaX/deltaY` wheel events on a fine pointer indicates a trackpad. The detection is non-persistent (recomputed from `pointer: coarse` media query and runtime wheel deltas) and falls back to the current "treat as mouse" default if signals are ambiguous.
- **Branch the wheel handler on the detected device class**:
  - **Trackpad**: two-finger scroll = pan (current direction: invert on first detected event so it feels natural — down-swipe moves content down). Pinch / Ctrl+wheel = zoom centered on the cursor. Shift+two-finger = horizontal pan.
  - **Mouse**: wheel = zoom centered on the cursor (matching the universal default). Shift+wheel = horizontal pan (unchanged).
- **Add middle-button pan** for desktop mouse: holding the middle button and dragging pans the canvas, the same way Figma, Miro, and draw.io do. The selection rectangle still works with left-button drag.
- **Align `MAX_ZOOM`** in the custom wheel handler with `<ReactFlow maxZoom={1.5}>` so the two paths can't disagree.
- **Disable React Flow's own `panOnScroll`** to remove the dual-handler race. The custom handler is the single source of truth.
- **Center zoom on the cursor** (today's handler zooms in place; that contributes to "the content jumps somewhere unexpected").
- The keyboard shortcuts (Delete, undo/redo, selection keys) are unchanged. Touch behavior is unchanged. The `<Controls>` zoom buttons and the existing fit-to-view triggers (auto-layout, walkthrough, focus mode) are unchanged.

## Capabilities

### New Capabilities

- `canvas-navigation`: Behavior of the canvas pan/zoom interaction across mouse, trackpad, and middle-button. Specifies which gestures do what, that zoom is cursor-centered, and that wheel/pan/zoom do not conflict with React Flow's own handlers.

### Modified Capabilities

_None._ No existing spec in `openspec/specs/` describes pan/zoom interaction, so this is a new capability rather than a delta.

## Impact

- **Source files touched**
  - `src/features/canvas/hooks/useCanvasInputProfile.ts` — add a "is trackpad" signal alongside the existing `isTouchDevice` / `isCoarsePointer` fields. Detection should be re-evaluated on `wheel` events (trackpad events are typically high-frequency with small deltas; mouse wheel events are low-frequency with large integer deltas).
  - `src/features/canvas/hooks/useCanvasEffects.ts` — replace the single-mode wheel handler with a branching handler that reads the input profile. Add middle-button support either here or in `useCanvasEventHandlers.ts` (whichever the team prefers during implementation).
  - `src/features/canvas/Canvas.tsx` — drop `panOnScroll` from the `<ReactFlow>` props (or set it explicitly to `false` to make the contract obvious), align the wheel-handler `MAX_ZOOM` constant with `maxZoom={1.5}`, and center zoom on the cursor.
  - `src/features/canvas/canvas.constants.ts` — update or remove the local `MAX_ZOOM` constant in `useCanvasEffects.ts` so it references the shared one.
- **Existing tests**
  - `cypress/e2e/stress-panels-performance.cy.ts` pan test uses right-drag — unchanged, still passes.
  - `cypress/e2e/stress-panels-interaction.cy.ts` zoom test uses the `<Controls>` buttons — unchanged, still passes.
  - The `fitView` stress tests are unaffected.
  - No new Cypress tests in this change (per the agreed scope).
- **i18n** — no new user-visible strings. The `<Controls>` zoom/fit buttons keep their built-in React Flow aria labels.
- **Persistence** — none. The input profile is non-persistent today; the "is trackpad" detection is also non-persistent.
- **Risk** — medium-low. Wheel behavior is the most subjective part of the app and regressions are easy to spot (one wheel gesture, wrong result). Middle-button pan only activates on a button that currently does nothing, so it cannot conflict with existing interactions. The detection heuristic is the riskiest piece; a "fall back to mouse behavior" default is the safety net.
- **Out of scope (Non-Goals)**
  - Persisting the user-chosen zoom/pan mode in localStorage or the diagram store.
  - Adding a settings UI to manually toggle trackpad vs mouse.
  - Adding new keyboard shortcuts for zoom in/out or fit-to-view.
  - Auto-fit on Mermaid/Drawio import (UX-001 territory; the auto-select it added is the right first step, and auto-fit can come in a follow-up).
  - Rewriting React Flow's `<Controls>` component or replacing the zoom buttons.
  - Adding new Cypress tests.
