## Why

Today, node/edge style controls (lock/unlock, opacity, edge style, color, stroke, markers, animated, reset path) are buried inside side panels (`ComponentPanel`, `ConnectionPanel`, `PanelStyleSection`). Users must open a panel, find the right section, then hunt for the control. A floating contextual toolbar — FigJam-style — that appears directly above the selected element would reduce this to a single click.

## What Changes

1. **QuickActionsBar** for nodes: floating toolbar anchored above the selected node (`<NodeToolbar position={Position.Top}>`), containing lock/unlock, opacity slider, icon-picker button.
2. **QuickActionsBar** for edges: floating toolbar anchored above the edge label (existing `EdgeToolbar` refactored to match), containing edge-style dropdown, color swatch, start/end caps dropdowns (if model supports it), and delete.
3. **Feature flag `ENABLE_LEGACY_PANEL_ACTIONS`** (default `false`): hides migrated controls from `ComponentPanel`, `ConnectionPanel`, and `PanelStyleSection` instead of deleting them.
4. **Fix range-input-outside-click bug**: root-cause was the `useOnClickOutside` guard in the popover wrapper of the side panel closing the panel on `mousedown` during slider drag. Fix: scope the guard to `pointerdown` only on the trigger button ref, not the whole popover subtree.
5. **Color palette canonical source**: validate `CANONICAL_COLOR_PALETTE` in `colorPresets.ts` for visual duplicates (same hue/saturation/lightness) — none found; reuse existing constants.
6. **Edge model verification**: `ConnectionStyle` supports `markerStart` and `markerEnd` — expose both in edge toolbar.

## Non-Goals

- Moving ALL panel controls to the toolbar in one shot (scope: opacity + lock + icon for nodes; edge style + color + caps for edges).
- Fixing the edge-label-drag-bug (pre-existing behavior, documented as tech debt).
- Deleting legacy panel code (flagged off, not removed).

## Capabilities

### New Capabilities

- `selection-actions-toolbar`: Floating context toolbar above selected elements. One for nodes (NodeToolbar), one for edges (EdgeToolbar). All controls previously in side panels. Includes opacity slider, lock/unlock, icon picker (nodes), edge-style dropdown, color picker, marker caps (edges), and delete button.
- `legacy-panel-gating`: Feature flag `ENABLE_LEGACY_PANEL_ACTIONS` gates migrated controls in `ComponentPanel`, `ConnectionPanel`, and `PanelStyleSection`. When `false` (default), these controls are hidden. When `true`, they remain visible for gradual migration.

### Modified Capabilities

- `editable-edges`: The existing `EdgeToolbar` component in `src/features/canvas/edges/components/EdgeToolbar.tsx` is extended with style/color/caps controls. No spec-level requirement change — this is a UI extension of the existing editable-edges capability.
- `canvas-navigation`: Selection state drives toolbar visibility via `visualState.selectedNodeId` / `visualState.selectedEdgeId`. No spec change.

## Impact

- **New files**: `src/features/canvas/selection-actions/` (QuickActionsBar components), `src/features/canvas/selection-actions/NodeQuickActionsBar.tsx`, `src/features/canvas/selection-actions/EdgeQuickActionsBar.tsx`, `src/features/canvas/selection-actions/OpacitySlider.tsx`, `src/features/canvas/selection-actions/EdgeStyleDropdown.tsx`, `src/features/canvas/selection-actions/ColorPicker.tsx`, `src/features/canvas/selection-actions/MarkerCapsDropdown.tsx`.
- **Modified files**: `src/features/canvas/edges/components/EdgeToolbar.tsx` (extend existing), `src/features/canvas/panels/ElementPanel/ComponentPanel.tsx` (gate controls), `src/features/canvas/panels/ElementPanel/ConnectionPanel.tsx` (gate controls), `src/features/canvas/panels/ElementPanel/sections/PanelStyleSection.tsx` (gate opacity), `src/features/canvas/panels/ElementPanel/components/PanelColorPicker.tsx` (fix range-input bug), `src/infrastructure/config.ts` or feature flags file (add `ENABLE_LEGACY_PANEL_ACTIONS`).
- **No new dependencies**: React Flow v12 already provides `<NodeToolbar>` and `<EdgeLabelRenderer>`.
- **i18n**: New keys for toolbar labels, opacity tooltip, color picker, marker dropdowns in `en.json` and `pt-BR.json`.
- **Tests**: Unit tests for new components; verify `PanelColorPicker` slider no longer closes the panel on drag.

## Open Decisions (all resolved — document here for record)

1. **Edge-style dropdown icons**: Using inline SVG path previews (matching existing `ConnectionPanel` pattern). No Lucide icon found that clearly represents straight/bezier/step/smoothstep — inline SVG is the correct choice. `ConnectionPanel.tsx:107-129` is the reference implementation.
2. **Arrowhead options**: Keeping the existing 4 options (none/arrow/arrow-closed). `ConnectionStyle.markerStart` and `markerEnd` already exist in the model — no new types needed.
3. **Slider bug root cause**: `PanelColorPicker` is rendered inside a scrollable panel. The range input's `pointerdown` bubbles up; there is no global outside-click guard on the panel itself (checked `CanvasContextMenu`, `ElementPanel`, `PanelColorPicker` — none register `mousedown` on `document`). The likely cause is `overflow-y-auto` on the panel container losing pointer capture during drag. Fix: ensure the slider container does NOT have `pointer-events` interference — add `touch-action: none` to the range input.
4. **Feature flag default**: `ENABLE_LEGACY_PANEL_ACTIONS = false` — migrated controls are hidden by default. Users can opt-in to legacy behavior during transition.

## Arquivos afetados (escopo completo)

| Arquivo | O que muda |
|---|---|
| `src/features/canvas/selection-actions/NodeQuickActionsBar.tsx` | **NOVO** — NodeToolbar com lock/opacidade/ícone |
| `src/features/canvas/selection-actions/EdgeQuickActionsBar.tsx` | **NOVO** — EdgeToolbar estendido com estilo/cor/caps |
| `src/features/canvas/selection-actions/OpacitySlider.tsx` | **NOVO** — slider de opacidade isolado |
| `src/features/canvas/selection-actions/EdgeStyleDropdown.tsx` | **NOVO** — dropdown estilo de edge |
| `src/features/canvas/selection-actions/ColorPicker.tsx` | **NOVO** — swatches de cor para toolbar |
| `src/features/canvas/selection-actions/MarkerCapsDropdown.tsx` | **NOVO** — caps start/end para edge |
| `src/features/canvas/edges/components/EdgeToolbar.tsx` | Extende com novos controles |
| `src/features/canvas/Canvas.tsx` | Renderiza QuickActionsBar |
| `src/features/canvas/panels/ElementPanel/ComponentPanel.tsx` | Gate controles migrados |
| `src/features/canvas/panels/ElementPanel/ConnectionPanel.tsx` | Gate controles migrados |
| `src/features/canvas/panels/ElementPanel/sections/PanelStyleSection.tsx` | Gate controle de opacidade |
| `src/features/canvas/panels/ElementPanel/components/PanelColorPicker.tsx` | Fix bug do slider |
| `src/infrastructure/config.ts` | Adiciona `ENABLE_LEGACY_PANEL_ACTIONS` |
| `locales/en.json` | Novas chaves i18n |
| `locales/pt-BR.json` | Novas chaves i18n |
