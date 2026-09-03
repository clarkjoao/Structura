# Plugin System UI Expansion — Implementation Tasks

## 1. Type System Updates ✅

- [x] 1.1 Add `"canvas-toolbar"` to `PluginPanelSlot` type in `plugin.types.ts`
- [x] 1.2 Add `"ui:overlays"` to `KNOWN_PLUGIN_CAPABILITIES` array
- [x] 1.3 Add Toast types to `plugin.types.ts`
- [x] 1.4 Add Modal types to `plugin.types.ts`
- [x] 1.5 Add `PluginToolbarContext` type

## 2. Overlay Registry ✅

- [x] 2.1 Create `src/features/plugins/overlay-registry.ts`
- [x] 2.2 Implement `showToast` (using existing Sonner)
- [x] 2.3 Implement `openModal` with single-modal enforcement
- [x] 2.4 Implement `closeModal` and cleanup

## 3. Toast Component (uses existing Sonner) ✅

- [x] 3.1 ToastContainer not needed - using existing Sonner integration
- [x] 3.2 Toast variants by type (Sonner handles this)
- [x] 3.3 Action button support (Sonner handles this)
- [x] 3.4 Sonner already wired in App.tsx

## 4. Modal Component ✅

- [x] 4.1 Create `src/features/plugins/components/PluginModal.tsx`
- [x] 4.2 Create `src/features/plugins/components/ModalOverlay.tsx`
- [x] 4.3 Wire `ModalOverlay` into `App.tsx`

## 5. Plugin API Updates ✅

- [x] 5.1 Update `createScopedPluginApi` in `plugin-api.ts`
- [x] 5.2 Implement `overlay.showToast`
- [x] 5.3 Implement `overlay.openModal`

## 6. Toolbar Slot Component ✅

- [x] 6.1 Create `src/features/plugins/components/PluginToolbarSlot.tsx`
- [x] 6.2 Integrate into `CanvasToolbar.tsx`

## 7. Context Updates for Toolbar ✅

- [x] 7.1 `PluginToolbarSlot` provides `PluginToolbarContext` (locale, isEditMode)
- [x] 7.2 Separate component for cleaner separation

## 8. i18n ✅

- [x] 8.1 Add `ui-overlays` capability label to `en.json` and `pt-BR.json`

## 9. Testing ⏭️

- [ ] 9.1 Unit tests for `overlay-registry.ts`
- [ ] 9.2 Integration tests for plugin API
- [ ] 9.3 E2E tests

## 10. Documentation ✅

- [x] 10.1 Update `docs/architecture/extension-points.md` with new slots and API
- [x] 10.2 Capability already documented in i18n keys

---

## Summary

**Core implementation complete (24/29 tasks)**

The plugin system now supports:

- `canvas-toolbar` slot for toolbar buttons
- `ui:overlays` capability for toasts and modals
- `api.overlay.showToast()` using Sonner
- `api.overlay.openModal()` with full modal system
