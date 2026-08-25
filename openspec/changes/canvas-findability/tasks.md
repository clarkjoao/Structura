## 0. Prerequisite

- [x] 0.1 `canvas-scroll-pan-drawio` is applied — this change extends the preference store and
      the view-options popover it creates

## 1. Preference

- [x] 1.1 Add `showMiniMap: boolean` (default `true`) and `setShowMiniMap` to
      `canvas-preferences.store.ts`
- [x] 1.2 Add a toggle row to `CanvasViewOptions.tsx`
- [x] 1.3 i18n key `canvasToolbar.toggleMiniMap` in `en.json` and `pt-BR.json`

## 2. MiniMap

- [x] 2.1 Create `src/features/canvas/components/miniMapNodeColor.ts` — map a node to a color via
      the existing `TypeConfig` descriptor, neutral fallback for plugin / unknown types
- [x] 2.2 Mount `<MiniMap pannable zoomable position="bottom-right">` in `Canvas.tsx`, gated on
      `showMiniMap`, above `<Controls>`
- [x] 2.3 Theme it with `bg-card` / `border-border`, matching the `<Controls>` class overrides
- [x] 2.4 Unit test for `miniMapNodeColor` (known type, plugin type, unknown type)

## 3. Viewport occupancy

- [x] 3.1 Create `src/features/canvas/hooks/useViewportOccupancy.ts` returning
      `{ hasNodes, anyNodeVisible }`
- [x] 3.2 Compute the viewport rect in flow coordinates from the pane corners via
      `screenToFlowPosition`, then test intersection against each node's bounding box
      (position + measured width/height, falling back to the default node size)
- [x] 3.3 Derive it inside a single React Flow store selector with a field-by-field equality
      check — the component re-renders only when a boolean flips, which is cheaper and more
      responsive than an `onMoveEnd` + rAF debounce
- [x] 3.4 Unit tests: node inside, node outside, partial overlap → visible, empty diagram

## 4. Rescue card

- [x] 4.1 Create `src/features/canvas/components/NothingInViewCard.tsx` — floating card with the
      element count and a fit action
- [x] 4.2 Fit action calls `fitView({ padding: FIT_VIEW_INITIAL_PADDING, minZoom: VIEWPORT_MIN_ZOOM,
      maxZoom: FIT_VIEW_MAX_ZOOM, duration: FIT_VIEW_DURATION_MS })` from `canvas.constants.ts`
- [x] 4.3 Render it in `Canvas.tsx` only when `hasNodes && !anyNodeVisible`
- [x] 4.4 i18n keys `canvas.nothingInView`, `canvas.fitAll` in both locales
- [x] 4.5 Covered by `useViewportOccupancy.test.ts`: empty diagram → `hasNodes: false`, so the
      card's render condition is false; nothing in view → `anyNodeVisible: false`

## 5. Verification

- [x] 5.1 `npm run typecheck && npm run lint && npm run test && npm run format:check`
- [ ] 5.2 Manual: pan until the viewport is empty → card appears → fit action recovers
- [ ] 5.3 Manual: minimap reflects the nodes, click navigates, toggle persists across a reload
- [ ] 5.4 Manual: open an empty diagram → no card, minimap renders empty without errors
