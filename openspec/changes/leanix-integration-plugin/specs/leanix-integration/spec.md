# Leanix Integration — Specification

## Purpose

Leanix ITSM integration plugin for mxgraph diagram export from Structura. Allows sending diagrams to Leanix with automatic name-based search and versioning.

## ADDED Requirements

### Requirement: Plugin manifest declares Leanix integration

The plugin SHALL declare the following manifest:
- `id`: `structura-plugin-leanix`
- `capabilities`: `["network", "ui:panels", "ui:overlays", "diagram:read"]`
- `apiVersion`: `"^1.1"` (requires diagram:read and ui:overlays capabilities)

### Requirement: Leanix configuration is persisted via plugin storage

The system SHALL persist Leanix configuration using the plugin's `api.storage` interface:

```typescript
interface LeanixConfig {
  baseUrl: string;    // Leanix instance URL (e.g., "https://company.leanix.net")
  authToken: string;  // Bearer token for authentication
  userId: string;     // Leanix User ID for document permissions
}
```

Storage key: `"leanix_config"`

#### Scenario: Save valid configuration
- **WHEN** user fills Base URL, Auth Token, and User ID, then clicks Save
- **THEN** configuration is stored via `api.storage.set("leanix_config", config)`
- **AND** `isConfigured` returns `true`

#### Scenario: Clear configuration
- **WHEN** user clicks "Clear Configuration"
- **THEN** `api.storage.remove("leanix_config")` is called
- **AND** `isConfigured` returns `false`

#### Scenario: Load configuration on startup
- **WHEN** the plugin initializes
- **THEN** it reads from `api.storage.get("leanix_config")`
- **AND** populates the config form if values exist

### Requirement: Toolbar button is enabled only when configured

The "Send to Leanix" button in the toolbar SHALL be:
- **Enabled** when: Leanix config exists AND diagram has a name AND user is in edit mode
- **Disabled** when: config missing OR diagram name is empty OR not in edit mode

#### Scenario: Button disabled without configuration
- **GIVEN** no Leanix configuration is saved
- **WHEN** the canvas toolbar renders
- **THEN** the "Send to Leanix" button is disabled with tooltip from `toolbar.tooltipNoConfig`

#### Scenario: Button disabled with empty diagram name
- **GIVEN** Leanix is configured but current diagram has no name
- **WHEN** the canvas toolbar renders
- **THEN** the button is disabled with tooltip from `toolbar.tooltipNoName`

#### Scenario: Button disabled when not in edit mode
- **GIVEN** Leanix is configured AND diagram has a name
- **WHEN** `context.isEditMode` is `false`
- **THEN** the button is disabled with tooltip from `toolbar.tooltipReadOnly`

#### Scenario: Button enabled with config and named diagram
- **GIVEN** Leanix is configured AND current diagram has name "Microservices Architecture" AND user is in edit mode
- **WHEN** the canvas toolbar renders
- **THEN** the "Send to Leanix" button is enabled

### Requirement: Send to Leanix searches for existing diagram

When user clicks "Send to Leanix", the plugin SHALL search for an existing diagram matching the current `diagram.name`:

```
GET {baseUrl}/services/navigation/v1/presentations/search?searchTerm={diagramName}
Headers:
  Authorization: {authToken}
  accept: application/json
```

#### Scenario: Find existing diagram by name
- **GIVEN** current diagram is named "Microservices Architecture"
- **WHEN** user clicks "Send to Leanix"
- **THEN** the plugin searches for `searchTerm=Microservices%20Architecture`
- **AND** if a diagram with matching name exists, it proceeds to update

#### Scenario: No diagram found creates new
- **GIVEN** current diagram is named "New Diagram" AND no Leanix diagram matches
- **WHEN** search returns empty results
- **THEN** the plugin creates a new diagram via POST

### Requirement: Update existing diagram preserves versions

If a diagram with matching name exists, the plugin SHALL update it by:

1. Updating the working copy:
```
PUT {baseUrl}/services/pathfinder/v1/bookmarks/{diagramId}/workingCopy
Body: { "state": { "graphXml": "<mxGraphModel>...", "version": 2, "viewport": {...}, "autoUpdate": true } }
```

2. Saving/publishing:
```
PUT {baseUrl}/services/pathfinder/v1/bookmarks/{diagramId}
Body: { "state": { "graphXml": "...", "version": 2, ... }, "lastModified": "{ISO8601}" }
```

#### Scenario: Update creates new version
- **GIVEN** Leanix diagram "Architecture" exists with ID "abc-123"
- **WHEN** user exports from Structura
- **THEN** the Leanix diagram receives a new version
- **AND** the existing version history is preserved

### Requirement: Create new diagram when not found

If no diagram with matching name exists, the plugin SHALL create a new diagram:

```
POST {baseUrl}/services/pathfinder/v1/bookmarks
Body: {
  "type": "VISUALIZER",
  "name": "{diagramName}",
  "description": "",
  "groupKey": "freedraw",
  "state": { "graphXml": "<mxGraphModel>...", "version": 2, "viewport": {...}, "autoUpdate": true },
  "permittedReadUserIds": ["{userId}"],
  "permittedWriteUserIds": ["{userId}"],
  "defaultSharingPriority": null,
  "workingCopy": { "state": { "graphXml": "...", "version": 2 } }
}
```

#### Scenario: Create diagram with correct permissions
- **GIVEN** Leanix config with userId "user-456"
- **WHEN** a new diagram is created
- **THEN** the diagram is created with `permittedReadUserIds: ["user-456"]`
- **AND** `permittedWriteUserIds: ["user-456"]`

### Requirement: Graph XML is exported as mxGraph format

The plugin SHALL use the existing mxGraph export service to generate the `graphXml` payload.

#### Scenario: Export uses existing mxGraph exporter
- **WHEN** the plugin needs to send diagram to Leanix
- **THEN** it calls the existing `exportDrawio()` or equivalent mxGraph export function
- **AND** the resulting XML is used as `state.graphXml`

### Requirement: Error handling provides actionable feedback

The plugin SHALL handle API errors with specific messages via `api.overlay.showToast()`:

| Error | User Message | Action |
|-------|--------------|--------|
| 401/403 | "Invalid or expired token" (`toasts.errorAuth`) | Show "Open Settings" button that opens config modal |
| 404 | (treated as not found) | Create new |
| 500 | "Leanix internal error" (`toasts.errorInternal`) | No action button |
| Network | "Connection error" (`toasts.errorConnection`) | Show "Retry" button |

#### Scenario: Invalid token shows config panel
- **WHEN** API returns 401 or 403
- **THEN** show error toast with title from `toasts.errorAuth`
- **AND** include action button: `toasts.openSettings` that opens the config modal

#### Scenario: Network error retries once
- **WHEN** network request fails
- **THEN** retry the request once
- **AND** if retry fails, show error toast with "Retry" button

### Requirement: Success toast includes link to Leanix

On successful export, the plugin SHALL show a success toast via `api.overlay.showToast()` with a clickable action to open the Leanix diagram.

#### Scenario: Success toast with link
- **WHEN** diagram is successfully exported to Leanix
- **THEN** show toast with title from `toasts.successCreated` or `toasts.successUpdated`
- **AND** include action button: `toasts.openInLeanix` that opens `{baseUrl}/pathfinder#/presentations/{id}` in new tab

### Requirement: Config panel allows editing credentials

The Leanix config panel SHALL provide:

- **Base URL** input field with placeholder "https://company.leanix.net"
- **Auth Token** input field (password type with reveal toggle)
- **User ID** input field
- **Save** button
- **Clear** button (removes config)

#### Scenario: Config form validation
- **WHEN** user tries to save with empty Base URL
- **THEN** show inline error "URL is required"
- **WHEN** user tries to save with empty Token
- **THEN** show inline error "Token is required"

### Requirement: All UI strings are internationalized

All user-visible strings SHALL use i18n with entries in both `en` and `pt-BR`.

Required translation keys:
- `toolbar.button` — Button label
- `toolbar.tooltipNoConfig` — "Configure Leanix in settings"
- `toolbar.tooltipNoName` — "Set a name for the diagram"
- `toasts.sending` — Loading message
- `toasts.successCreated` — "Diagram created in Leanix!"
- `toasts.successUpdated` — "Diagram updated in Leanix!"
- `toasts.openInLeanix` — "Open in Leanix"
- `toasts.errorAuth` — "Invalid or expired token"
- `toasts.errorConnection` — "Connection error"
- `toasts.errorInternal` — "Leanix internal error"
- `config.title` — Config modal title
- `config.baseUrl` — "Base URL"
- `config.authToken` — "Auth Token"
- `config.userId` — "User ID"
- `config.save` — "Save"
- `config.clear` — "Clear Configuration"

### Requirement: API calls use server proxy for CORS

All Leanix API calls SHALL go through the server proxy at `/proxy/leanix` to bypass CORS restrictions.

#### Scenario: API calls routed through proxy
- **WHEN** the plugin makes any Leanix API call
- **THEN** the request goes to `/proxy/leanix/services/...`
- **AND** the server forwards to `{LEANIX_BASE_URL}/services/...`
- **AND** the `Authorization` header is forwarded

### Requirement: Server proxy configuration

The server SHALL accept the following environment variables:
- `PROXY_REVERSE_LEANIX_URL` — Base URL of Leanix instance
- `PROXY_REVERSE_LEANIX_API_TOKEN` — Optional fallback auth token

#### Scenario: Proxy route configuration
- **GIVEN** environment has `PROXY_REVERSE_LEANIX_URL=https://company.leanix.net`
- **WHEN** plugin calls `/proxy/leanix/services/pathfinder/v1/bookmarks`
- **THEN** server proxies to `https://company.leanix.net/services/pathfinder/v1/bookmarks`
