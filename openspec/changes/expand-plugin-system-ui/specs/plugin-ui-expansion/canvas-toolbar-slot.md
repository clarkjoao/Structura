# Plugin System — Canvas Toolbar Slot

## Purpose

Extends the plugin system to allow plugins to contribute buttons to the canvas toolbar via the `canvas-toolbar` slot.

## MODIFIED Requirements

### Requirement: PluginPanelSlot type includes canvas-toolbar

The `PluginPanelSlot` type SHALL include `"canvas-toolbar"` as a valid slot value.

#### Scenario: Type includes canvas-toolbar
- **WHEN** TypeScript compiles plugin code using `slot: "canvas-toolbar"`
- **THEN** no type error occurs

### Requirement: CanvasToolbarSlot renders toolbar panels

The system SHALL render a `<PluginToolbarSlot slot="canvas-toolbar" />` component inside `CanvasToolbar.tsx` that displays all plugin panels registered for the `canvas-toolbar` slot.

#### Scenario: Plugin registers toolbar panel
- **GIVEN** an active plugin registers a panel with `slot: "canvas-toolbar"`
- **WHEN** the canvas toolbar renders
- **THEN** the plugin panel is visible in the toolbar

#### Scenario: No toolbar panels registered
- **GIVEN** no plugin has registered a `canvas-toolbar` panel
- **WHEN** the canvas toolbar renders
- **THEN** no additional elements are rendered

### Requirement: Toolbar panels receive context

Toolbar panels SHALL receive a `PluginToolbarContext` as their `context` prop:

```typescript
interface PluginToolbarContext {
  /** Current locale ("en" | "pt-BR") */
  locale: string;
  /** Whether the user is in edit mode */
  isEditMode: boolean;
}
```

#### Scenario: Panel receives edit mode context
- **GIVEN** a plugin panel registered for `canvas-toolbar`
- **WHEN** the toolbar renders
- **THEN** `context.isEditMode` reflects whether editing is allowed

### Requirement: Toolbar panels render button-like UI

Panels in the `canvas-toolbar` slot are expected to render compact button-like UI suitable for a toolbar. The host provides no styling guarantees beyond error boundary wrapping.

#### Scenario: Panel renders a button
- **GIVEN** a plugin panel registered for `canvas-toolbar` with a button component
- **WHEN** the toolbar renders
- **THEN** the button is visible and clickable

### Requirement: Toolbar panels can use overlay capabilities

Panels registered in `canvas-toolbar` SHALL have access to `api.showToast` and `api.openModal` if they declare the `ui:overlays` capability.

#### Scenario: Toolbar button shows toast on click
- **GIVEN** a plugin registered panels for `canvas-toolbar` with `ui:panels` and `ui:overlays`
- **WHEN** user clicks the toolbar button
- **THEN** `api.showToast({ type: "success", title: "Done!" })` displays a toast
