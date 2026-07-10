## 1. Feature Flag

- [x] 1.1 Add `ENABLE_LEGACY_PANEL_ACTIONS` constant (`false`) to `src/features/canvas/selection-actions/featureFlags.ts`

## 2. i18n Keys

- [x] 2.1 Add toolbar i18n keys to `locales/en.json` (lock/unlock labels, opacity tooltip, icon picker, edge style dropdown, color picker, marker caps, delete)
- [x] 2.2 Add corresponding translations to `locales/pt-BR.json`

## 3. PanelColorPicker Slider Bug Fix

- [x] 3.1 Add `touch-action: none` CSS to the range input in `PanelColorPicker.tsx`
- [x] 3.2 Add `onPointerDown={(e) => e.stopPropagation()}` on the slider container div
- [x] 3.3 Verify the fix: drag slider from 0→100 in the panel, panel stays open

## 4. OpacitySlider Component

- [x] 4.1 Create `src/features/canvas/selection-actions/OpacitySlider.tsx`
- [x] 4.2 Render `<input type="range">` with min=0, max=100, step=1
- [x] 4.3 Add `touch-action: none` to the range input
- [x] 4.4 Accept `value`, `onChange`, `label` props; display percentage next to slider
- [x] 4.5 Export from `src/features/canvas/selection-actions/index.ts`

## 5. ColorPicker Toolbar Component

- [x] 5.1 Create `src/features/canvas/selection-actions/ColorPicker.tsx`
- [x] 5.2 Import and use `VIBRANT_PRESETS` from `colorPresets.ts`
- [x] 5.3 Accept `selectedColor`, `onSelectColor`, `onReset` props
- [x] 5.4 Render compact row of circular swatches (h-5 w-5, same style as `ConnectionPanel.tsx:362-372`)
- [x] 5.5 Export from `src/features/canvas/selection-actions/index.ts`

## 6. EdgeStyleDropdown Component

- [x] 6.1 Create `src/features/canvas/selection-actions/EdgeStyleDropdown.tsx`
- [x] 6.2 Copy the edge style options and SVG path previews from `ConnectionPanel.tsx:107-129`
- [x] 6.3 Accept `currentStyle`, `onChangeStyle` props
- [x] 6.4 Render as a dropdown (button that opens a small popover/menu with the style options)
- [x] 6.5 Each option shows the SVG preview + label
- [x] 6.6 Export from `src/features/canvas/selection-actions/index.ts`

## 7. MarkerCapsDropdown Component

- [x] 7.1 Create `src/features/canvas/selection-actions/MarkerCapsDropdown.tsx`
- [x] 7.2 Reuse `markerOptions` from `ConnectionPanel.tsx:140-147`
- [x] 7.3 Accept `currentCap`, `onChangeCap`, `capType` ("start"|"end") props
- [x] 7.4 Render as a compact dropdown showing the current cap's label
- [x] 7.5 Export from `src/features/canvas/selection-actions/index.ts`

## 8. NodeQuickActionsBar Component

- [x] 8.1 Create `src/features/canvas/selection-actions/NodeQuickActionsBar.tsx`
- [x] 8.2 Use `<NodeToolbar nodeId={nodeId} isVisible position={Position.Top} offset={10}>` from `@xyflow/react`
- [x] 8.3 Accept `nodeId`, `diagramId`, `updateComponent` props; component fetched via `useComponent`
- [x] 8.4 Render lock/unlock button (Lucide `Lock`/`Unlock`), `OpacitySlider`, icon picker button
- [x] 8.5 Wire lock/unlock: `updateComponent(nodeId, { locked: !component.locked })`
- [x] 8.6 Wire opacity slider: `updateComponent(nodeId, { panelOpacity: value })`
- [x] 8.7 Wire icon picker: open existing `IconPickerModal`, on select call `updateComponent(nodeId, { customIconId })`
- [x] 8.8 Add i18n labels via `useTranslation()`
- [x] 8.9 Export from `src/features/canvas/selection-actions/index.ts`

## 9. EdgeToolbar Extension (extend existing)

- [x] 9.1 Extend `src/features/canvas/edges/components/EdgeToolbar.tsx` interface with new props: `edgeStyle`, `edgeColor`, `markerStart`, `markerEnd`, `onStyleChange`, `onColorChange`, `onMarkerStartChange`, `onMarkerEndChange`
- [x] 9.2 Add `EdgeStyleDropdown` to the toolbar
- [x] 9.3 Add `ColorPicker` (compact, no reset) to the toolbar
- [x] 9.4 Add `MarkerCapsDropdown` for marker-end to the toolbar
- [x] 9.5 Add `MarkerCapsDropdown` for marker-start to the toolbar
- [x] 9.6 Wire all new controls to their respective update callbacks
- [x] 9.7 Keep existing routing toggle, reset, and delete buttons — they remain functional

## 10. Wire Toolbars into Canvas

- [x] 10.1 In `EditableEdge.tsx`, extend the `EdgeToolbar` call with new props from `connection.style`
- [x] 10.2 In `Canvas.tsx`, render `NodeQuickActionsBar` when `visualState.selectedNodeId` is set and `selectedNodes.length === 1`
- [x] 10.3 Pass `nodeId`, `diagramId`, `updateComponent` to `NodeQuickActionsBar`
- [x] 10.4 Verify toolbars render without errors in the canvas

## 11. Gate Legacy Panel Controls

- [x] 11.1 In `ComponentPanel.tsx`, wrap the lock/unlock button with `ENABLE_LEGACY_PANEL_ACTIONS` guard
- [x] 11.2 In `ComponentPanel.tsx`, wrap `<PanelStyleSection>` with `ENABLE_LEGACY_PANEL_ACTIONS` guard
- [x] 11.3 In `ConnectionPanel.tsx`, wrap edge-style buttons section with `ENABLE_LEGACY_PANEL_ACTIONS` guard
- [x] 11.4 In `ConnectionPanel.tsx`, wrap stroke style + width selects with `ENABLE_LEGACY_PANEL_ACTIONS` guard
- [x] 11.5 In `ConnectionPanel.tsx`, wrap marker start/end selects with `ENABLE_LEGACY_PANEL_ACTIONS` guard
- [x] 11.6 In `ConnectionPanel.tsx`, wrap animated checkbox with `ENABLE_LEGACY_PANEL_ACTIONS` guard
- [x] 11.7 In `ConnectionPanel.tsx`, wrap reset path button with `ENABLE_LEGACY_PANEL_ACTIONS` guard
- [x] 11.8 In `ConnectionPanel.tsx`, wrap color swatches section with `ENABLE_LEGACY_PANEL_ACTIONS` guard

## 12. Tests

- [x] 12.1 Run `tsc --noEmit` and fix any type errors
- [x] 12.2 Add unit tests for `OpacitySlider` (value changes, label display)
- [x] 12.3 Add unit tests for `ColorPicker` (swatch click calls onSelectColor)
- [x] 12.4 Add unit tests for `EdgeStyleDropdown` (option click calls onChangeStyle)
- [x] 12.5 Add unit tests for `MarkerCapsDropdown` (option click calls onChangeCap)
- [ ] 12.6 Add integration test: verify PanelColorPicker slider drag does not close the panel
- [x] 12.7 Run existing Vitest suite — all tests pass (230 passing)
- [ ] 12.8 Run existing Cypress `stress-panels-performance.cy.ts` — pass

## 13. QA Checklist

- [ ] 13.1 Select a node → toolbar appears above the node, contains lock/opacity/icon
- [ ] 13.2 Drag opacity slider from 0→100 → toolbar stays open
- [ ] 13.3 Click lock icon → component locks/unlocks
- [ ] 13.4 Click icon picker → modal opens, select icon → component updates
- [ ] 13.5 Select an edge → edge toolbar appears above label with style/color/caps/delete
- [ ] 13.6 Change edge style → edge re-renders with new style
- [ ] 13.7 Change edge color → edge re-renders with new color
- [ ] 13.8 Change marker-end → arrowhead updates
- [ ] 13.9 Delete from toolbar → edge removed
- [ ] 13.10 Multi-select (2+ nodes) → node toolbar hidden, `MultiSelectPanel` shows
- [ ] 13.11 `ENABLE_LEGACY_PANEL_ACTIONS=false` → legacy controls hidden, toolbars work
- [ ] 13.12 `ENABLE_LEGACY_PANEL_ACTIONS=true` → legacy controls visible, toolbars work
- [x] 13.13 Color picker has no visual duplicates (verified against `VIBRANT_PRESETS`)
- [x] 13.14 All new UI strings present in `en.json` and `pt-BR.json`

## 14. Commit (Conventional Commits)

- [x] 14.1 `feat(canvas): add ENABLE_LEGACY_PANEL_ACTIONS feature flag`
- [x] 14.2 `feat(canvas): create OpacitySlider, ColorPicker, EdgeStyleDropdown, MarkerCapsDropdown`
- [x] 14.3 `feat(canvas): create NodeQuickActionsBar with lock/opacity/icon`
- [x] 14.4 `feat(canvas): extend EdgeToolbar with style/color/caps controls`
- [x] 14.5 `fix(canvas): scope panel outside-click guard to popover ref for range input`
- [x] 14.6 `feat(canvas): gate legacy panel controls behind ENABLE_LEGACY_PANEL_ACTIONS`
- [x] 14.7 `feat(i18n): add toolbar i18n keys for en and pt-BR`
- [x] 14.8 `test(canvas): add unit tests for selection-actions components`
