## Why

The canvas is infinite and there is no way to see where you are in it. A user who pans far from
the content ends up staring at an empty grid with nothing to steer by.

What exists today: `CanvasSearch` (`src/features/canvas/toolbar/CanvasSearch.tsx`) finds a
component by name / description / technology / tags and focuses it, and `<Controls>` offers a
fit-view button. Both require the user to already know what they are looking for, or to notice
the small control in the corner. There is no spatial overview — React Flow's `<MiniMap>` is not
mounted anywhere in the editor — and nothing reacts when the viewport ends up empty.

## What Changes

1. **MiniMap.** Mount React Flow's `<MiniMap pannable zoomable>` bottom-right, above
   `<Controls>`. Node color comes from the type descriptor already used by the canvas
   (`TypeConfig`, the same source `CanvasSearch` uses for its result icons), with a neutral
   fallback for plugin and unknown types. Themed with the same tokens as `<Controls>`.
2. **Toggle.** The MiniMap costs screen space on small viewports, so it is a persisted
   preference (`showMiniMap`, default `true`) surfaced in the same "Canvas view" popover
   introduced by `canvas-scroll-pan-drawio`.
3. **"Nothing in view" rescue.** When the diagram has nodes but none of them intersect the
   current viewport, a floating card appears with the element count and a "Fit all" button that
   calls `fitView` with the constants already in `canvas.constants.ts`. This is the direct fix
   for getting lost: it appears exactly when the user is lost, and disappears on its own.

## Non-Goals

- Off-screen edge arrows / cluster indicators. Deferred: higher implementation and maintenance
  cost, and the rescue card already covers the "I see nothing" case.
- An outline / layers panel listing every element. `CanvasSearch` already covers lookup by name;
  a browsing list is a separate change.
- Changing `CanvasSearch` itself, or the fit-view button in `<Controls>`.
- Adding a MiniMap to `ViewerCanvas` or `WalkthroughEditorCanvas`.

## Capabilities

### Modified Capabilities

- `canvas-navigation`: gains a spatial-overview requirement and an empty-viewport recovery
  requirement. Nothing in the existing pan/zoom behavior changes.

## Impact

- **Depends on** `canvas-scroll-pan-drawio`, which creates
  `src/features/canvas/preferences/canvas-preferences.store.ts` and
  `CanvasViewOptions.tsx`. This change adds `showMiniMap` to that store and one row to that
  popover. Apply it second.
- **New files**: `src/features/canvas/hooks/useViewportOccupancy.ts` (+ test),
  `src/features/canvas/components/NothingInViewCard.tsx` (+ test),
  `src/features/canvas/components/miniMapNodeColor.ts`.
- **Modified files**: `src/features/canvas/Canvas.tsx`,
  `src/features/canvas/preferences/canvas-preferences.store.ts`,
  `src/features/canvas/toolbar/components/CanvasViewOptions.tsx`,
  `src/infrastructure/i18n/locales/en.json`, `src/infrastructure/i18n/locales/pt-BR.json`.
- **No new dependencies** — `<MiniMap>` ships with `@xyflow/react` v12.
- **i18n**: `canvas.nothingInView`, `canvas.fitAll`, `canvasToolbar.toggleMiniMap` in both locales.
