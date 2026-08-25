# Plugin System — Overlay API (Toasts & Modals)

## Purpose

Provides plugins with user feedback capabilities through toast notifications and modal dialogs via the `ui:overlays` capability.

## ADDED Requirements

### Requirement: ui:overlays capability is recognized

The `KNOWN_PLUGIN_CAPABILITIES` array SHALL include `"ui:overlays"`.

#### Scenario: Plugin declares ui:overlays capability
- **WHEN** a plugin manifest declares `capabilities: ["ui:overlays"]`
- **THEN** the capability is recognized and allowed

### Requirement: showToast method displays a toast

`StructuraPluginApi.showToast(options)` SHALL display a toast notification with the given options:

```typescript
interface ToastOptions {
  /** Toast type determines color/icon: "success" | "error" | "info" | "warning" */
  type: "success" | "error" | "info" | "warning";
  /** Required title text */
  title: string;
  /** Optional description/body text */
  description?: string;
  /** Optional action button */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Duration in ms before auto-dismiss (default: 5000, 0 = persistent) */
  duration?: number;
}
```

#### Scenario: Show success toast
- **WHEN** plugin calls `api.showToast({ type: "success", title: "Diagram saved!" })`
- **THEN** a success toast appears with title "Diagram saved!"
- **AND** it auto-dismisses after 5 seconds

#### Scenario: Show error toast with action
- **WHEN** plugin calls `api.showToast({ type: "error", title: "Upload failed", description: "Try again", action: { label: "Retry", onClick: () => {} } })`
- **THEN** an error toast appears with title, description, and a "Retry" button
- **AND** clicking "Retry" invokes the onClick handler

#### Scenario: Toast without ui:overlays capability
- **GIVEN** a plugin without `ui:overlays` in its manifest
- **WHEN** the plugin calls `api.showToast(...)`
- **THEN** a warning is logged
- **AND** no toast is displayed (graceful degradation)

### Requirement: openModal method opens a modal

`StructuraPluginApi.openModal(options)` SHALL open a modal dialog:

```typescript
interface ModalOptions {
  /** Modal title displayed in header */
  title: string;
  /** React component for modal content */
  content: React.ComponentType<{ onClose: () => void }>;
  /** Optional callback when modal is closed */
  onClose?: () => void;
  /** Modal size: "sm" (400px) | "md" (500px, default) | "lg" (700px) */
  size?: "sm" | "md" | "lg";
}
```

#### Scenario: Open a simple modal
- **WHEN** plugin calls `api.openModal({ title: "Settings", content: SettingsComponent })`
- **THEN** a modal opens with title "Settings"
- **AND** the SettingsComponent renders inside the modal body
- **AND** SettingsComponent receives `{ onClose }` prop

#### Scenario: Modal content can close itself
- **GIVEN** a modal is open with a SettingsComponent that has a "Cancel" button
- **WHEN** user clicks "Cancel" which calls `onClose()`
- **THEN** the modal closes
- **AND** the plugin's `onClose` callback (if provided) is invoked

#### Scenario: Modal closes on backdrop click
- **GIVEN** a modal is open
- **WHEN** user clicks the backdrop outside the modal
- **THEN** the modal closes
- **AND** the plugin's `onClose` callback (if provided) is invoked

#### Scenario: Modal closes on Escape key
- **GIVEN** a modal is open
- **WHEN** user presses Escape
- **THEN** the modal closes

#### Scenario: Modal without ui:overlays capability
- **GIVEN** a plugin without `ui:overlays` in its manifest
- **WHEN** the plugin calls `api.openModal(...)`
- **THEN** a warning is logged
- **AND** no modal opens (graceful degradation)

### Requirement: Only one modal at a time

The system SHALL enforce that only one modal can be open at a time. Opening a new modal while one is already open replaces the existing modal.

#### Scenario: Second modal replaces first
- **GIVEN** plugin opens modal A with `api.openModal(...)`
- **WHEN** plugin opens modal B with `api.openModal(...)`
- **THEN** modal A is closed
- **AND** modal B is displayed

### Requirement: Modal content has access to close function

The modal content component receives `{ onClose: () => void }` as props, allowing the content to programmatically close the modal.

#### Scenario: Modal button closes modal
- **GIVEN** a modal is open with content `{ onClose } => <button onClick={onClose}>Close</button>`
- **WHEN** user clicks the Close button
- **THEN** the modal closes

### Requirement: Toast and modal APIs are namespaced

The `StructuraPluginApi` SHALL expose overlay methods under an `overlay` namespace:

```typescript
interface StructuraPluginApi {
  // ... existing methods
  readonly overlay: {
    showToast(options: ToastOptions): void;
    openModal(options: ModalOptions): void;
  };
}
```

#### Scenario: API is namespaced
- **WHEN** plugin calls `api.overlay.showToast({...})`
- **THEN** a toast is displayed
- **WHEN** plugin calls `api.overlay.openModal({...})`
- **THEN** a modal opens

### Requirement: Overlay state persists across component mounts

Toast queue and modal state are managed at the application level, not within individual components. Plugins should not assume toasts/modals are tied to their panel lifecycle.

#### Scenario: Toast after panel unmounts
- **GIVEN** a plugin panel calls `api.overlay.showToast(...)`
- **WHEN** the panel unmounts
- **THEN** the toast continues to display until dismissed or timed out
