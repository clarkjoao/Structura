# Leanix Integration Plugin — Design

## Context

Structura is a client-side SPA for C4 diagramming with no backend. The Leanix integration allows diagrams to be exported to the company's central architecture repository via REST API. Leanix has CORS protection, requiring a proxy for browser→API calls.

The plugin system was expanded (commit `eab7e66`) to support `canvas-toolbar` slot and `ui:overlays` capability for richer plugin integrations. This spec reflects those capabilities.

The existing plugin structure (`structura-plugin-mermaid-import`) serves as a reference for the plugin organization pattern. The React plugin example (`structura-plugin-example-ui`) demonstrates toolbar button implementation with toasts and modals.

## Goals / Non-Goals

**Goals:**
- Standalone React plugin in `plugins/structura-plugin-leanix/`
- Credentials configuration via plugin's own config storage
- "Send to Leanix" button in the canvas toolbar (via `canvas-toolbar` slot)
- Name-based search → update or create
- Visual feedback via toasts (via `ui:overlays` capability)
- Server proxy at `/leanix` for CORS bypass

**Non-Goals:**
- Import from Leanix (future)
- Auto-sync (future)
- Multiple workspaces support
- Inline Leanix diagram editing

## Decisions

### Decision 1: Plugin Directory Structure

**Chosen:** `plugins/structura-plugin-leanix/` (React/TypeScript plugin, compiled with Vite)

**Alternative:** Standalone npm bundle or plain JavaScript

**Rationale:** Following the pattern from `structura-plugin-example-ui`. React enables a rich settings panel with form validation. Use existing build tooling (Vite) to compile TypeScript→JS. File-based installation is simple.

### Decision 2: Plugin Capabilities

**Required capabilities:**
- `network` — for Leanix API fetch calls
- `ui:panels` — for configuration panel (settings slot)
- `ui:overlays` — for toast notifications (success, error, loading)
- `diagram:read` — to read `diagram.name` before export

**Rationale:** `network` is essential (API calls); `ui:panels` for settings panel; `ui:overlays` for toast feedback (success on export, errors on failure); `diagram:read` to get current diagram name.

### Decision 3: Configuration Storage

**Pattern adopted:** Plugin's own storage via `api.storage`

**Format:**
```typescript
interface LeanixConfig {
  baseUrl: string;      // e.g., "https://company.leanix.net"
  authToken: string;    // Full Bearer token
  userId: string;       // Leanix User ID for permissions
}
```

**Alternative:** localStorage directly — rejected; `api.storage` provides cleaner API and potential future sync.

### Decision 4: Export Flow

```
1. User clicks "Send to Leanix" (toolbar button)
2. Show loading toast "Sending to Leanix..."
3. Search diagram by searchTerm = diagram.name
4. If found (200 with data[]):
   - PUT /workingCopy → PUT /
   - Replace loading toast with success toast + "Open in Leanix" action
5. If not found (404 or data[] empty):
   - POST /bookmarks (create new)
   - Replace loading toast with success toast + link
6. On error:
   - 401/403 → Error toast "Invalid or expired token" + action to open settings
   - 500 → Error toast "Leanix internal error" + retry button
   - Network → Retry 1x, then error toast
```

**Rationale:** Search first avoids duplicates. Always create new if not exists (Leanix versions automatically on save). Toasts provide immediate feedback during the async flow.

### Decision 5: Leanix API via Proxy

**Proxied endpoints:**
- `GET /services/navigation/v1/presentations/search`
- `POST /services/pathfinder/v1/bookmarks`
- `PUT /services/pathfinder/v1/bookmarks/{id}/workingCopy`
- `PUT /services/pathfinder/v1/bookmarks/{id}`

**Headers sent:**
```
Authorization: {authToken}
accept: application/json
```

**Note:** Token already includes "Bearer " prefix from user.

### Decision 6: Button Position

**Canvas Toolbar** — via `ui:panels` capability with `slot: "canvas-toolbar"`.

**Implementation:** Register a panel contribution:
```typescript
api.registerPanel({
  id: "leanix-toolbar",
  slot: "canvas-toolbar",
  title: { en: "Leanix", "pt-BR": "Leanix" },
  component: LeanixToolbarButton
});
```

**Rationale:** Follows the plugin UI expansion pattern. Button appears alongside native toolbar buttons.

### Decision 7: Settings Panel

**Location:** Plugin provides its own settings panel component.

**Fields:**
- Base URL (text input)
- Auth Token (password input, with reveal toggle)
- User ID (text input)

**Buttons:** Save | Clear Configuration

**Implementation:** Register panel for `element-inspector` or show via modal triggered from toolbar.

### Decision 8: Toast Notifications

**Using:** `api.overlay.showToast(options)` from `ui:overlays` capability

**Toast types used:**
- `info` — Loading state during export
- `success` — Export completed with action to open Leanix
- `error` — Failure with retry or settings action

**Rationale:** Plugin uses host's toast system for consistent UX. Actions allow direct navigation to settings on auth errors.

## Risks / Trade-offs

**[Risk]** Expired token causes silent error
- **Mitigation:** Specifically handle 401/403, showing error toast with action to open settings panel.

**[Risk]** Diagram name too long for searchTerm
- **Mitigation:** Truncate searchTerm to 255 chars (typical API limit).

**[Risk]** Diagrams with identical names for different users
- **Mitigation:** Search uses `permittedReadUserIds` from token. Each user sees only their diagrams.

**[Risk]** Mid-flow failure (workingCopy ok, save fails)
- **Mitigation:** Leanix keeps workingCopy as draft. Next retry tries update again.

**[Risk]** User not in edit mode when clicking toolbar button
- **Mitigation:** Toolbar button is disabled when `context.isEditMode === false`.

## Migration Plan

1. **Development:** React plugin in `plugins/structura-plugin-leanix/`
2. **Testing:** Test with Leanix staging workspace
3. **Deploy:** Build plugin → upload dist/plugin.js from Plugins page + proxy endpoint on server
4. **Rollback:** Uninstall plugin from Plugins page, remove proxy route

## Open Questions

1. **Permission granularity:** Should `userId` in creation payload be the same as token or can it be different (admin creating for another user)?

2. **Diagram description:** Leave empty or include default (e.g., "Created via Structura on {date}")?

3. **Toast link:** Does Leanix provide direct URL to diagram? If not, use `${baseUrl}/pathfinder#/presentations/{id}`.

4. **Settings panel location:** Should it be in `element-inspector` when a component is selected, or always available via modal from toolbar?
