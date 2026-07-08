## 1. Branch and prep

- [ ] 1.1 Confirm the working branch is `feat/ux-002-canvas-zoom` and that it is off `main`.
- [ ] 1.2 Confirm the working tree starts clean for files we are about to edit (ignore `.gitignore` and `vite.config.ts` modifications inherited from main).

## 2. Extend the input profile

- [ ] 2.1 In `src/features/canvas/hooks/useCanvasInputProfile.ts`, add a `likelyTrackpad: boolean` field to `CanvasInputProfile` and initialize it to `false`.
- [ ] 2.2 Implement a small ring-buffer of recent wheel events inside the hook's effect (timestamp + `deltaX` + `deltaY`) and update `likelyTrackpad` when the buffer shows repeated small non-integer deltas with non-zero `deltaX`. The detector MUST NOT call `preventDefault` on the observed event.
- [ ] 2.3 Ensure the field is consulted only when `prefersTouchCanvasUi` is `false` (so touch devices and styluses are unaffected).

## 3. Rewrite the wheel handler

- [ ] 3.1 In `src/features/canvas/hooks/useCanvasEffects.ts`, replace the existing single-mode wheel handler with a branching handler that reads `inputProfile.likelyTrackpad` and `prefersTouchCanvasUi` from the new profile.
- [ ] 3.2 Implement cursor-centered zoom: compute the world point under the cursor from the current viewport, apply the new zoom, then re-anchor the viewport so the same world point stays under the cursor.
- [ ] 3.3 Trackpad branch: plain wheel = pan (use both `deltaX` and `deltaY`, keeping the current "content follows fingers" sign convention); Ctrl/Ctrl+wheel = zoom; Shift+wheel = horizontal pan.
- [ ] 3.4 Mouse branch: plain wheel = zoom; Shift+wheel = horizontal pan; Ctrl/Cmd+wheel = zoom (legacy fallback).
- [ ] 3.5 Remove the local `MAX_ZOOM = 1` constant from this file and source the value from a shared constant in `src/features/canvas/canvas.constants.ts` (proposed name: `WHEEL_MAX_ZOOM = 1.5` to match `<ReactFlow maxZoom={1.5}>`). Import and use it.

## 4. Disable React Flow's competing handler

- [ ] 4.1 In `src/features/canvas/Canvas.tsx`, set `panOnScroll={false}` on the `<ReactFlow>` element so the custom handler is the only one processing wheel events. Keep `zoomOnPinch` enabled.
- [ ] 4.2 Verify the existing `PanOnScrollMode` import is still used (or remove it if it becomes dead) so `npm run lint` stays clean.

## 5. Add middle-button pan

- [ ] 5.1 In `src/features/canvas/hooks/useCanvasEventHandlers.ts` (or the equivalent place that handles pane pointer events), add a `pointerdown` listener for the middle button (`e.button === 1`) on the pane.
- [ ] 5.2 Capture the pointer, prevent the browser default (autoscroll / back), and translate `pointermove` deltas into `reactFlowInstance.setViewport` calls. Release on `pointerup` / `pointercancel`.
- [ ] 5.3 Guard the listener so it does not fire when `nodesDraggable` is false, when in compare mode, or when in flow playback (mirror the guards used in the existing `onPaneContextMenu` handler).

## 6. Verify

- [ ] 6.1 Run `npm run typecheck` — must be green.
- [ ] 6.2 Run `npm run lint` — must be clean.
- [ ] 6.3 Run `npm run format` to normalize formatting.
- [ ] 6.4 Run `npm run test` — existing unit tests must still pass.
- [ ] 6.5 Run the existing stress suite `npm run cy:run:stress` — pan / zoom-controls / fitView tests must still pass.
- [ ] 6.6 Manual smoke: scroll with a mouse (must zoom centered on cursor), scroll with Shift (must pan horizontally), middle-button drag (must pan), pinch on a trackpad if available (must zoom).

## 7. Commit and OpenSpec archive prep

- [ ] 7.1 Commit on the branch with a Conventional Commits message (e.g. `feat(canvas): branch pan/zoom on trackpad vs mouse and add middle-button pan`).
- [ ] 7.2 Leave the change un-archived; archiving happens after the PR is merged (per the existing repo workflow seen in `openspec/changes/archive/`).
