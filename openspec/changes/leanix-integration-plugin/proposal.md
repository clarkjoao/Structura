## Why

The company uses Leanix as the central repository for architecture diagrams. Currently, diagrams created in Structura need to be manually exported and re-imported into Leanix. This process is error-prone and creates rework. Direct integration allows architects to publish their diagrams to Leanix with a single click, maintaining automatic versioning and name-based search.

## What Changes

- **New React Plugin `structura-plugin-leanix`**: Standalone plugin that adds "Send to Leanix" button to the canvas toolbar via `canvas-toolbar` slot
- **Integrated configuration**: Settings modal for Auth Token, Base URL, and User ID (via `api.storage`)
- **Automatic name-based search**: Searches for existing diagram in Leanix before creating
- **Automatic versioning**: Uses Leanix workingCopy + save API to create versions
- **Visual feedback**: Toasts via `ui:overlays` capability with success/error/loading states and action buttons
- **Server proxy**: Adds `/leanix` endpoint to existing proxy for CORS bypass

## Capabilities

### New Capabilities

- **leanix-integration**: Leanix ITSM integration plugin for mxgraph diagram export. Includes:
  - Credentials configuration (baseUrl, authToken, userId)
  - Name-based diagram search (searchTerm)
  - New diagram creation
  - Existing diagram update (workingCopy + save)
  - Toolbar button UI for export (`canvas-toolbar` slot)
  - Toast notifications for user feedback (`ui:overlays` capability)
  - User-friendly error feedback with retry/settings actions

### Modified Capabilities

- **plugin-system**: Extends with example usage for external integration via:
  - `ui:panels` with `canvas-toolbar` slot
  - `ui:overlays` for toast notifications

## Impact

- **New directory**: `plugins/structura-plugin-leanix/` (React/TypeScript, following `structura-plugin-example-ui` pattern)
- **Server proxy**: Adds `/leanix` route in `server/src/proxy.ts`
- **Storage**: Uses `api.storage` for config persistence
- **Dependencies**: No new app dependencies (plugin uses host's React and toast system)
- **i18n**: Adds translation labels for "Send to Leanix", toast messages, config modal

## Non-Goals

- Importing diagrams from Leanix to Structura (future)
- Auto-sync on save (future)
- Multiple Leanix workspaces support
- Direct Leanix diagram editing within Structura
