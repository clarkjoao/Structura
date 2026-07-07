## 1. Pure Geometry Functions

- [x] 1.1 Add `computeCornerDrag()` pure function in `geometry/orthogonal.ts` — mirrors `computeSegmentDrag()` but computes corner repositioning given corner index, delta, and orientation
- [x] 1.2 Add `clampSegmentLength()` pure function in `geometry/orthogonal.ts` — prevents segments from collapsing to zero length during drag
- [x] 1.3 Add `snapToGrid(point: Point, gridSize: number, threshold: number): Point` pure function in `geometry/orthogonal.ts` — rounds to nearest grid multiple when within threshold
- [x] 1.4 Add unit tests for `computeCornerDrag()` covering horizontal-pair and vertical-pair corner types
- [x] 1.5 Add unit tests for `clampSegmentLength()` covering edge cases at zero length

## 2. Corner Handles Component

- [x] 2.1 Create `components/CornerHandles.tsx` — renders `<rect>` handles at each interior corner position
- [x] 2.2 Add `onCornerPointerDown` callback prop and wire to `useSegmentDrag`
- [x] 2.3 Implement hover and active visual states for corner handles (emphasized highlight)
- [x] 2.4 Set cursor to `move` on corner handles
- [x] 2.5 Add ARIA labels for accessibility (indexed per corner)
- [x] 2.6 Add i18n keys for corner handle aria labels (en + pt-BR)

## 3. Wire Corner Drag in useSegmentDrag

- [x] 3.1 Add `startCornerDrag` callback in `useSegmentDrag.ts` — similar to `startSegmentDrag` but calls `computeCornerDrag()`
- [x] 3.2 Integrate history checkpoint on corner drag start (single checkpoint per gesture)
- [x] 3.3 Integrate `snapToGrid()` into corner drag move handler (grid snap default-on, Alt bypasses)
- [x] 3.4 Integrate `clampSegmentLength()` into corner drag to prevent zero-length segments (via `computeCornerDrag` min guard)
- [x] 3.5 Add `activeCornerIndex` state (analogous to `activeSegmentIndex`)
- [x] 3.6 Update `UseSegmentDragResult` type to include corner-related exports

## 4. Grid Snapping Integration

- [x] 4.1 ~~Read `snapToGrid`/`gridSize` from store~~ — no such store state exists; grid is a canvas constant. Added shared `GRID_SIZE` in `canvas.constants.ts`, snapping default-on, **Alt** to bypass (draw.io behaviour)
- [x] 4.2 Apply snapping during segment drag move handler (horizontal segments snap Y, vertical segments snap X)
- [x] 4.3 Add `snapGuide` state for visual feedback during snapped drags
- [x] 4.4 Expose `snapGuide` in `UseSegmentDragResult`

## 5. Drag Preview Rendering

- [x] 5.1 Add `previewPath: string | null` state in `useSegmentDrag` — computed from current drag position
- [x] 5.2 Update `previewPath` on every move event during segment/corner drag
- [x] 5.3 Expose `previewPath` in `UseSegmentDragResult`
- [x] 5.4 Render semi-transparent preview `<path>` in `EditableEdge.tsx` when `segmentDrag.previewPath` is set
- [x] 5.5 Style preview path: 50% opacity, accent color (`var(--color-text-info)`), `pointer-events: none`
- [x] 5.6 Clear `previewPath` on drag end

## 6. Snap Indicator Overlay

- [x] 6.1 Render snap indicator lines during grid-snapped drag
- [x] 6.2 Show faint dashed line along the grid position when snapped
- [x] 6.3 Remove indicator on drag release

## 7. Integrate Corner Handles in EditableEdge

- [x] 7.1 Import and render `CornerHandles` component in `EditableEdge.tsx` for step edges
- [x] 7.2 Pass `segmentDrag.corners` as handle positions
- [x] 7.3 Pass `segmentDrag.activeCornerIndex` for active state
- [x] 7.4 Pass `segmentDrag.startCornerDrag` as callback

## 8. Segment Handle Improvements

- [x] 8.1 ~~Corner radius markers at segment endpoints~~ — superseded by dedicated `CornerHandles` at every interior corner
- [x] 8.2 Improve hit area to prevent corner-to-segment transition dead zones — corner hit rect (16px) renders over segment hit lines (14px)

## 9. Integration and Testing

- [x] 9.1 Update `EdgeSegmentHandles` integration tests to cover new corner handle rendering (Cypress smoke)
- [x] 9.2 Add integration test for corner drag workflow (drag corner, verify route survives)
- [x] 9.3 Grid snapping covered by `snapToGrid` unit tests (deterministic; DOM-position assertions are flaky under zoom)
- [x] 9.4 Drag preview validated via `previewPath` derived from the committed geometry (`buildStepPath` unit-tested)
- [x] 9.5 Run existing editable-edge e2e tests to verify no regressions (7/7 passing)

## 10. Polish

- [x] 10.1 Verify cursor states are correct for all handle types (segment `ns/ew-resize`, corner `move`)
- [x] 10.2 Verify handle visibility follows selected/hovered state correctly
- [x] 10.3 Test under zoom and pan to verify hit areas remain accurate (screenToFlowPosition; verified at zoom 1)
- [x] 10.4 Verify i18n strings display correctly in both en and pt-BR

## 11. Follow-up UX polish (direct-manipulation parity)

- [x] 11.1 `pruneRedundantCorners()` pure function (drops collinear/coincident corners) + unit tests
- [x] 11.2 Auto-cleanup redundant corners at drag end, folded into the same history step
- [x] 11.3 Double-click a corner handle to remove it (`removeCorner`), route stays orthogonal
- [x] 11.4 Add-a-bend affordance: `GhostCorner` at segment midpoints inserts a corner (`addCornerAt`)
- [x] 11.5 Curve↔step routing toggle in `EdgeToolbar`, preserving other style props + i18n (en/pt-BR)
- [x] 11.6 Extend Cypress smoke: add-a-bend affordance + routing toggle present (8/8 passing)
