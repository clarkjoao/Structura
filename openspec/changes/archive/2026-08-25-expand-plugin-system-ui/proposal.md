## Why

The current plugin system provides UI contributions via `ui:panels` for side panels only (`element-inspector`, `service-registry-import`). Plugins that need to add buttons to the canvas toolbar, display toast notifications, or open modal dialogs have no supported extension point. This limits the types of integrations possible without modifying core application code.

## What Changes

- **New panel slot `canvas-toolbar`**: Allows plugins to add buttons to the canvas toolbar
- **New capability `ui:overlays`**: Enables plugins to show toast notifications and modal dialogs
- **New API method `api.showToast()`**: Displays user feedback messages
- **New API method `api.openModal()`**: Opens plugin-controlled modal dialogs
- **PluginToolbarSlot component**: Host-side component rendering toolbar contributions

## Capabilities

### New Capabilities

- **plugin-ui-expansion**: Extends the plugin system with canvas toolbar integration and overlay support. Creates:
  - `specs/plugin-ui-expansion/canvas-toolbar-slot.md` — Canvas toolbar contribution spec
  - `specs/plugin-ui-expansion/overlay-api.md` — Toast and modal API spec

### Modified Capabilities

- **plugin-system**: Adds `canvas-toolbar` and `global-overlay` to `PluginPanelSlot` type

## Impact

- **Modified files**:
  - `src/features/plugins/plugin.types.ts` — Add new slot and API types
  - `src/features/plugins/plugin-api.ts` — Add new API methods
  - `src/features/canvas/toolbar/CanvasToolbar.tsx` — Add toolbar slot
  - `src/components/ui/toast.tsx` — Export Toast component for plugin use (or create overlay system)
- **New files**:
  - `src/features/plugins/components/PluginToolbarSlot.tsx`
  - `src/features/plugins/overlay-registry.ts`
- **i18n**: Add keys for new plugin-related strings

## Non-Goals

- Full modal dialog system with built-in dialog types (plugins provide their own modal content)
- Notification center/history (toasts are ephemeral)
- Plugin-to-plugin communication
- Drag-and-drop toolbar customization (static order)
