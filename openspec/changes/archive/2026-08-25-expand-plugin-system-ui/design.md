# Plugin System UI Expansion — Design

## Context

The existing plugin system in Structura supports `ui:panels` capability for side panel contributions. The `PluginPanelSlot` component renders registered panels in two slots:
- `element-inspector` — Right panel when component is selected
- `service-registry-import` — Service catalog import section

This design adds canvas toolbar support and overlay capabilities (toasts/modals) to enable richer plugin integrations.

## Goals / Non-Goals

**Goals:**
- Allow plugins to add buttons to the canvas toolbar
- Provide a toast notification API for plugins
- Provide a modal dialog API for plugins
- Keep plugin contributions self-contained (plugin provides its own React component)

**Non-Goals:**
- Built-in modal dialog types (plugins own their modal content)
- Notification history/center
- Plugin-to-plugin communication
- User-configurable toolbar layout

## Decisions

### Decision 1: Canvas Toolbar Slot

**Slot ID:** `canvas-toolbar`

**Rendering:** New `<PluginToolbarSlot slot="canvas-toolbar" />` in `CanvasToolbar.tsx`, positioned alongside existing toolbar buttons.

**Context:** Unlike `element-inspector` which provides selection context, toolbar panels receive:
```typescript
interface ToolbarPanelContext {
  locale: string;
  isEditMode: boolean;
}
```

**Rationale:** Toolbar buttons have different needs than inspector panels. They don't need component selection context; they need to know if editing is allowed.

### Decision 2: Toast API

**API Method:** `api.showToast(options: ToastOptions)`

```typescript
interface ToastOptions {
  type: "success" | "error" | "info" | "warning";
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number; // ms, default 5000
}
```

**Implementation:** Plugins register a toast handler via the overlay registry. The host's toast system renders the toast. Plugin provides content; host provides styling and lifecycle.

**Rationale:** Single method is simpler than exposing the full toast store. Plugins don't need programmatic control beyond "show this message".

### Decision 3: Modal API

**API Method:** `api.openModal(options: ModalOptions)`

```typescript
interface ModalOptions {
  title: string;
  content: React.ComponentType<{ onClose: () => void }>;
  onClose?: () => void;
  size?: "sm" | "md" | "lg";
}
```

**Implementation:** The host provides a modal shell (title bar, backdrop, close button). The plugin provides the content component via render prop pattern. This allows plugins to build any modal content without host modifications.

**Rationale:** Render prop pattern keeps the API simple. Host handles backdrop, focus trap, escape key. Plugin handles content.

### Decision 4: Capability Split

**Toolbar:** Uses existing `ui:panels` capability with new `canvas-toolbar` slot.

**Overlays:** New capability `ui:overlays` required for `showToast` and `openModal`.

**Rationale:** Plugins that only add toolbar buttons shouldn't need the overlay capability. Clear separation of concerns.

### Decision 5: Backward Compatibility

Existing plugins using `element-inspector` or `service-registry-import` slots continue to work unchanged.

New slots (`canvas-toolbar`) are opt-in for plugins.

**Rationale:** No breaking changes to existing plugin ecosystem.

## Risks / Trade-offs

**[Risk]** Multiple plugins adding toolbar buttons could clutter the UI
- **Mitigation:** Toolbar slot renders buttons in a predictable order. Future enhancement could add user-configurable visibility.

**[Risk]** Toast stacking from multiple plugins
- **Mitigation:** Toast queue with auto-dismiss. Toasts from same plugin are grouped.

**[Risk]** Modal blocking the entire app
- **Mitigation:** Only one modal at a time per plugin. Host enforces modal stack.

## Open Questions

1. Should toolbar buttons from multiple plugins be visually grouped or interspersed with native buttons?
2. Should toasts persist across route changes (e.g., from canvas to settings)?
