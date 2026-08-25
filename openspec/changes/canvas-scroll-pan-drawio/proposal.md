## Why

On a trackpad the canvas zooms when the user only meant to scroll.

`useCanvasInputProfile` classifies the pointing device from wheel events, and
`isTrackpadLikeEvent` (`src/features/canvas/hooks/useCanvasInputProfile.ts:52`) requires
`deltaX !== 0` on at least four events inside a 400 ms window. A plain vertical two-finger
scroll produces `deltaX === 0`, so it never reaches the trackpad threshold; the wheel handler
then takes the `!isTrackpad` branch (`src/features/canvas/hooks/useCanvasEffects.ts:133`) and
zooms. Three further problems compound it: the classification is one-way (it never flips back),
the very first wheel events always zoom while detection is still cold, and the user has no way
to override the guess.

draw.io does not guess. Scrolling pans, `Ctrl`/`Cmd`+scroll zooms, and the behavior is an
explicit setting. That is the model the user asked for.

## What Changes

1. **Scrolling pans by default**, on every pointing device. Two-finger scroll and mouse wheel
   both translate the viewport on both axes.
2. **`Ctrl`/`Cmd`+wheel zooms**, centered on the cursor. This is also how the browser delivers a
   trackpad pinch, so pinch-to-zoom keeps working with no special case.
3. **`Shift`+wheel pans horizontally** — unchanged.
4. **Delete the trackpad heuristic.** `likelyTrackpad`, `TrackpadSample`, the `TRACKPAD_*`
   constants and the global wheel listener come out of `useCanvasInputProfile`. What remains is
   `isTouchDevice` / `isCoarsePointer` / `prefersTouchCanvasUi`, which keep driving the touch
   props on `<ReactFlow>`.
5. **Persisted preference** `scrollMode: "pan" | "zoom"` (default `"pan"`) in a new
   canvas-scoped zustand `persist` store, exposed through a "Canvas view" popover next to
   `<Controls>`. There is no Settings page in the app (`App.tsx` routes: `/workspace`,
   `/walkthroughs`, `/model/:id`, `/collab/:roomId`, `/catalog`, `/plugins`), so the preference
   lives on the canvas where it applies.
6. **Normalize `deltaMode`** before using the deltas, so a mouse reporting `DOM_DELTA_LINE`
   pans a sane distance instead of 3 px per notch.

The wheel intent is extracted as a pure function so the whole matrix is unit-testable without a
DOM.

## Non-Goals

- Changing `panOnScroll={false}` on `<ReactFlow>`. The custom handler in `useCanvasEffects`
  stays the single source of truth for wheel-driven pan and zoom.
- Changing the touch/stylus branch, middle-button pan, `maxZoom`, or the zoom step factor.
- Changing `ViewerCanvas` or `WalkthroughEditorCanvas`, which use React Flow's own
  `panOnScroll` and are already pan-first.
- Adding a general Settings page.

## Capabilities

### Modified Capabilities

- `canvas-navigation`: the runtime trackpad/mouse classification and the two device-specific
  wheel requirements are removed and replaced by a single device-independent model (scroll pans,
  `Ctrl`/`Cmd`+wheel zooms) plus a persisted user preference. The middle-button pan, max-zoom
  and single-handler requirements are unchanged. The "No new translation keys" requirement is
  removed: the preference control needs labels.

## Impact

- **New files**: `src/features/canvas/preferences/canvas-preferences.store.ts` (+ index),
  `src/features/canvas/hooks/resolve-wheel-intent.ts` (+ test),
  `src/features/canvas/toolbar/components/CanvasViewOptions.tsx`.
- **Modified files**: `src/features/canvas/hooks/useCanvasEffects.ts` (wheel handler),
  `src/features/canvas/hooks/useCanvasInputProfile.ts` (delete the heuristic),
  `src/features/canvas/Canvas.tsx` (drop `likelyTrackpad` usage, mount the popover),
  `src/features/canvas/hooks/useCanvasController.ts` (profile type),
  `src/infrastructure/i18n/locales/en.json`, `src/infrastructure/i18n/locales/pt-BR.json`.
- **No new dependencies.** The preference store follows the existing pattern of
  `src/features/icons/store/icons.store.ts` (feature-scoped zustand + `persist`), so no
  `PERSIST_SCHEMA_VERSION` bump is involved.
- **i18n**: new keys for the popover title, the two scroll-mode options, and their hints, in
  both `en` and `pt-BR`.
