# Plugin System UI Expansion — Implementation Tasks

## 1. Type System Updates

- [ ] 1.1 Add `"canvas-toolbar"` to `PluginPanelSlot` type in `plugin.types.ts`

- [ ] 1.2 Add `"ui:overlays"` to `KNOWN_PLUGIN_CAPABILITIES` array

- [ ] 1.3 Add Toast types to `plugin.types.ts`:
  ```typescript
  interface ToastOptions {
    type: "success" | "error" | "info" | "warning";
    title: string;
    description?: string;
    action?: { label: string; onClick: () => void };
    duration?: number;
  }
  ```

- [ ] 1.4 Add Modal types to `plugin.types.ts`:
  ```typescript
  interface ModalOptions {
    title: string;
    content: React.ComponentType<{ onClose: () => void }>;
    onClose?: () => void;
    size?: "sm" | "md" | "lg";
  }

  interface PluginToolbarContext {
    locale: string;
    isEditMode: boolean;
  }
  ```

- [ ] 1.5 Add `PluginToolbarContext` to `PluginPanelContext` union (or create separate type)

## 2. Overlay Registry

- [ ] 2.1 Create `src/features/plugins/overlay-registry.ts`:
  ```typescript
  // Manages toast queue and modal state
  export const overlayRegistry = {
    toasts: new Map<string, ToastOptions>(),
    activeModal: null as ModalOptions | null,
    listeners: new Set<() => void>(),
    showToast(options: ToastOptions): void;
    openModal(options: ModalOptions): void;
    closeModal(): void;
    subscribe(listener: () => void): () => void;
  };
  ```

- [ ] 2.2 Implement `showToast` with unique ID generation

- [ ] 2.3 Implement `openModal` with single-modal enforcement

- [ ] 2.4 Implement `closeModal` and cleanup

## 3. Toast Component

- [ ] 3.1 Create `src/features/plugins/components/ToastContainer.tsx`:
  - Renders all active toasts from overlay registry
  - Position: bottom-right corner
  - Auto-dismiss based on `duration`
  - Close button on each toast

- [ ] 3.2 Create toast variants by `type`:
  - success: green checkmark icon
  - error: red X icon
  - warning: yellow warning icon
  - info: blue info icon

- [ ] 3.3 Add action button support in toast component

- [ ] 3.4 Wire `ToastContainer` into `App.tsx` at root level

## 4. Modal Component

- [ ] 4.1 Create `src/features/plugins/components/PluginModal.tsx`:
  - Backdrop with click-to-close
  - Modal container with title header
  - Size variants: sm (400px), md (500px), lg (700px)
  - Close button (X) in header
  - Escape key handler for close
  - Focus trap inside modal
  - Renders plugin-provided `content` component with `{ onClose }` prop

- [ ] 4.2 Create `src/features/plugins/components/ModalOverlay.tsx`:
  - Renders when `activeModal` is set
  - Wraps `PluginModal`

- [ ] 4.3 Wire `ModalOverlay` into `App.tsx`

## 5. Plugin API Updates

- [ ] 5.1 Update `createScopedPluginApi` in `plugin-api.ts`:
  - Add `warnUndeclaredCapability(manifest, "ui:overlays")` to new methods
  - Add `overlay` namespace to returned API object

- [ ] 5.2 Implement `overlay.showToast`:
  ```typescript
  showToast(options: ToastOptions): void {
    warnUndeclaredCapability(manifest, "ui:overlays");
    overlayRegistry.showToast(options);
  }
  ```

- [ ] 5.3 Implement `overlay.openModal`:
  ```typescript
  openModal(options: ModalOptions): void {
    warnUndeclaredCapability(manifest, "ui:overlays");
    overlayRegistry.openModal(options);
  }
  ```

## 6. Toolbar Slot Component

- [ ] 6.1 Create `src/features/plugins/components/PluginToolbarSlot.tsx`:
  ```typescript
  interface PluginToolbarSlotProps {
    slot: "canvas-toolbar";
  }

  // Renders all panels for the slot
  // Provides ToolbarPanelContext (locale, isEditMode)
  ```

- [ ] 6.2 Integrate into `CanvasToolbar.tsx`:
  - Import `PluginToolbarSlot`
  - Add `<PluginToolbarSlot slot="canvas-toolbar" />` in toolbar layout
  - Pass `isEditMode` based on interaction mode

## 7. Context Updates for Toolbar

- [ ] 7.1 Update `PluginPanelSlot.tsx` to handle `canvas-toolbar` slot differently:
  - Use `PluginToolbarContext` instead of `PluginPanelContext`
  - Different rendering (button-like vs section-wrapped)

- [ ] 7.2 Create separate `PluginToolbarPanelSlot` if needed for cleaner separation

## 8. i18n

- [ ] 8.1 Add generic plugin overlay strings to `en.json` and `pt-BR.json`:
  ```json
  {
    "plugins.toast.close": "Close",
    "plugins.modal.close": "Close"
  }
  ```

## 9. Testing

- [ ] 9.1 Unit tests for `overlay-registry.ts`:
  - Toast queue management
  - Modal open/close
  - Single-modal enforcement

- [ ] 9.2 Integration tests for plugin API:
  - `showToast` calls registry
  - `openModal` calls registry
  - Warning logged without capability

- [ ] 9.3 E2E tests:
  - Plugin registers toolbar panel → appears in toolbar
  - Plugin calls `showToast` → toast appears
  - Plugin calls `openModal` → modal opens and closes

## 10. Documentation

- [ ] 10.1 Update `docs/architecture/extension-points.md` with new slots and API

- [ ] 10.2 Document `ui:overlays` capability in plugin development guide
