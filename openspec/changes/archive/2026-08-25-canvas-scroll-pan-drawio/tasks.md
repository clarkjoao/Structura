## 1. Preference store

- [x] 1.1 Create `src/features/canvas/preferences/canvas-preferences.store.ts` — zustand +
      `persist`, storage key `structura:canvas-preferences`, following
      `src/features/icons/store/icons.store.ts`
- [x] 1.2 State: `scrollMode: "pan" | "zoom"` (default `"pan"`), action `setScrollMode`
- [x] 1.3 Barrel `src/features/canvas/preferences/index.ts`

## 2. Wheel intent as a pure function

- [x] 2.1 Create `src/features/canvas/hooks/resolve-wheel-intent.ts` exporting
      `resolveWheelIntent(event, scrollMode, paneHeight) => { kind: "pan" | "zoom", dx, dy, factor }`
- [x] 2.2 Normalize `deltaMode`: `DOM_DELTA_LINE` × line height, `DOM_DELTA_PAGE` × `paneHeight`,
      `DOM_DELTA_PIXEL` as-is (add the line-height constant to `canvas.constants.ts`)
- [x] 2.3 Precedence: `ctrlKey || metaKey` → zoom; else `shiftKey` → horizontal pan;
      else `scrollMode` decides
- [x] 2.4 Unit tests covering the full matrix: plain scroll in `"pan"`, plain scroll in `"zoom"`,
      ctrl+wheel, meta+wheel, shift+wheel, ctrl+shift+wheel (zoom wins), all three delta modes,
      and the sign of the pan translation

## 3. Wheel handler

- [x] 3.1 `useCanvasEffects.ts` — read `scrollMode` from the preference store
- [x] 3.2 Rewrite `handleWheel` to delegate to `resolveWheelIntent` and apply the result via
      `cursorCenteredZoom` (existing) or `setViewport`
- [x] 3.3 Add `scrollMode` to the effect dependency array; keep `{ passive: false }` and the
      `preventDefault`
- [x] 3.4 Confirm `panOnScroll={false}` stays on `<ReactFlow>` (single-handler requirement)

## 4. Remove the trackpad heuristic

- [x] 4.1 `useCanvasInputProfile.ts` — delete `likelyTrackpad`, `TrackpadSample`,
      `isTrackpadLikeEvent`, the `TRACKPAD_*` / `PROFILE_UPDATE_DEBOUNCE_MS` constants and the
      wheel-listener effect
- [x] 4.2 Update the `CanvasInputProfile` type and every consumer (`Canvas.tsx`,
      `useCanvasController.ts`, `useCanvasEffects.ts` params)

## 5. Canvas view options popover

- [x] 5.1 Create `src/features/canvas/toolbar/components/CanvasViewOptions.tsx` — popover
      anchored next to `<Controls>`, radio group Move / Zoom bound to `scrollMode`
- [x] 5.2 Mount it in `Canvas.tsx` beside `<Controls>`, matching the existing `<Controls>`
      theming (`bg-card`, `border-border`)
- [x] 5.3 i18n keys in `en.json` and `pt-BR.json`: popover title, "Scroll: move", "Scroll: zoom",
      and a hint line naming the Ctrl/Cmd+scroll shortcut

## 6. Verification

- [x] 6.1 `npm run typecheck && npm run lint && npm run test && npm run format:check`
- [ ] 6.2 Manual on a trackpad: plain vertical two-finger scroll pans and never zooms
- [ ] 6.3 Manual: Ctrl+scroll and Cmd+scroll zoom on the cursor; pinch zooms
- [ ] 6.4 Manual: Shift+scroll pans horizontally
- [ ] 6.5 Manual: switch to Zoom mode, reload, confirm the preference stuck
- [ ] 6.6 Manual: middle-button drag still pans; `<Controls>` zoom buttons still reach `maxZoom`
