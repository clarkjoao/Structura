## Context

Node/edge style controls (opacity, lock, icon, edge style, color, markers, reset path) currently live exclusively in collapsible side panels (`ComponentPanel`, `ConnectionPanel`, `PanelStyleSection`). The goal is a floating FigJam-style toolbar above the selected element — reducing the interaction from "open panel → find section → find control" to a single click.

The canvas already uses `@xyflow/react` v12 which provides `<NodeToolbar position={Position.Top}>` and `<EdgeLabelRenderer>` for this exact purpose. An `EdgeToolbar` component already exists in `src/features/canvas/edges/components/EdgeToolbar.tsx` with routing controls; it needs extension.

## Goals / Non-Goals

**Goals:**
- Node toolbar (via `<NodeToolbar>`) with: lock/unlock, opacity slider, icon picker — above the node.
- Edge toolbar (extended `EdgeToolbar`) with: edge-style dropdown, color swatch, marker caps dropdowns, delete — above the edge label.
- Feature flag `ENABLE_LEGACY_PANEL_ACTIONS` (default `false`) gates migrated controls in panels without deleting them.
- Fix the range-input-outside-click bug in `PanelColorPicker`.
- Canonical color palette reused from existing `colorPresets.ts` (`VIBRANT_PRESETS`).

**Non-Goals:**
- Migrating ALL panel controls in this PR (scope: opacity + lock + icon for nodes; style + color + caps + delete for edges).
- Deleting legacy panel code (only hidden behind flag).
- Fixing the edge-label-drag behavior (pre-existing, documented as tech debt).
- Adding persistence for toolbar position/size preferences.

## Decisions

### 1. Toolbar positioning via React Flow primitives

**Decision:** Use `<NodeToolbar position={Position.Top} offset={10}>` from `@xyflow/react` for nodes. For edges, position the toolbar manually via `EdgeLabelRenderer` using the computed `labelPoint` (already available in `EditableEdge.tsx`).

**Rationale:** This is the idiomatic React Flow approach. `NodeToolbar` automatically handles viewport-relative positioning and visibility tied to node selection. For edges, `EdgeLabelRenderer` is the existing pattern used by `EdgeToolbar` — no change needed there.

**Alternative considered:** Absolute-positioned `<div>` with viewport coordinates from `useReactFlow()`. Would require manual coordinate transforms and deselection handling. More error-prone.

### 2. Extending vs replacing the existing EdgeToolbar

**Decision:** Extend `src/features/canvas/edges/components/EdgeToolbar.tsx` with new controls, passing new props.

**Rationale:** The existing component is well-integrated (`EditableEdge.tsx:338`). Refactoring it to accept a richer props interface keeps existing behavior (routing toggle, reset, delete) while adding style controls. No new files for the toolbar shell itself.

### 3. Feature flag implementation

**Decision:** Add `ENABLE_LEGACY_PANEL_ACTIONS` to `src/infrastructure/config.ts` as a constant, defaulting to `false`. Panels read this flag and conditionally render migrated controls.

**Rationale:** No runtime config system exists. A simple boolean constant is sufficient for a migration-time feature flag. Using `import.meta.env.VITE_*` would add build-time complexity unnecessary for a short-transition flag.

**Migration controls to gate:**

In `ComponentPanel.tsx`:
- Lock/unlock button (header area)
- Controls in `PanelStyleSection.tsx`: opacity slider, color picker, border style

In `ConnectionPanel.tsx`:
- Edge-style buttons
- Stroke style select
- Stroke width select
- Marker start/end selects
- Animated checkbox
- Reset path button
- Color swatches

### 4. Range-input bug fix (outside-click on slider)

**Decision:** Add `touch-action: none` CSS to the range input and wrap it with `pointer-events: auto`. The slider lives in `PanelColorPicker.tsx` which is inside a panel with `overflow-y-auto`.

**Root cause hypothesis (not fully confirmed — requires live debugging):** The range input's `pointerdown` may lose event capture when the scroll container intercepts it. React Flow v12 may also have pointer capture on the pane that interferes.

**Fix sequence:**
1. Confirm the bug by checking if `PanelColorPicker`'s range input is the culprit during live testing.
2. Add `onPointerDown={(e) => e.stopPropagation()}` on the slider container div (not the input — the container wraps the label+input).
3. If that doesn't fix it, add `useEffect` with `setPointerCapture` on `pointerdown`.
4. Only if both fail: move the slider into a portal rendered outside the scrollable panel.

**Note:** The slider moves INTO the toolbar as part of this feature, so this fix addresses the panel version only during the transition period (flag `true`).

### 5. Color palette reuse

**Decision:** Use `VIBRANT_PRESETS` from `src/features/canvas/panels/ElementPanel/components/colorPresets.ts` for the toolbar color swatches.

**Rationale:** These are the same swatches used in `ConnectionPanel`. No duplication — import and reuse. `NOTE_PRESETS` and `C4_PRESETS` are panel-specific and should not be added to the toolbar palette.

### 6. Icon picker integration

**Decision:** Single button in the node toolbar opens the existing `IconPickerModal`. On selection, calls `updateComponent` with the new icon. A reset option sets icon to the default.

**Rationale:** `IconPickerModal` already exists and handles all icon sources (library, Lucide, AWS, upload). Reuse it via a callback prop pattern.

### 7. Edge marker support (start + end caps)

**Decision:** Expose both `markerStart` and `markerEnd` dropdowns in the edge toolbar. The `ConnectionStyle` model already supports both fields (`src/features/diagram/model/connection.types.ts:14-15`).

**Rationale:** This was listed as an open question in the prompt. The model already supports it — no new types or schema changes needed. The toolbar can expose both without waiting for a data migration.

## Risks / Trade-offs

- **[Risk] Toolbar overlaps with node controls (resize handles, delete button):** `NodeToolbar` renders inside the node boundary. For small nodes, it may overlap other controls. → **Mitigation:** Use `offset={10}` and `position={Position.Top}`; the toolbar auto-positions above the node. Accept minor overlap for small nodes as a known limitation.
- **[Risk] Multi-select shows multiple toolbars:** `NodeToolbar` appears for each selected node by default. → **Mitigation:** Only render `NodeQuickActionsBar` when exactly one node is selected (`selectedNodeIds.size === 1`). For multi-select, the existing `MultiSelectPanel` remains the control surface.
- **[Risk] Edge toolbar hidden behind edge:** The `EdgeLabelRenderer` renders above the edge but may be occluded by the pane. → **Mitigation:** The existing `EdgeToolbar` uses `z-[3]` which is sufficient. No changes planned.
- **[Risk] Performance on many elements:** Rendering toolbars for each selected element adds DOM nodes. → **Mitigation:** Toolbars only render when `selectedNodeId` or `selectedEdgeId` is non-null. React Flow's own virtualization handles the canvas.

## Migration Plan

1. **Phase 1 (this PR):** Feature flag off by default. Legacy panels show all controls. New toolbars are rendered but not wired to update state (verify no errors). This is a smoke test.
2. **Phase 2:** Wire toolbars to state mutations. Verify `tsc --noEmit`, tests pass.
3. **Phase 3:** Set flag to `false` in prod config after user testing.
4. **Phase 4:** After user confirmation of no regressions, set flag to `true` (show legacy panels alongside toolbars). Then delete legacy controls in a follow-up PR.
