# Leanix Integration Plugin

Export diagrams from Structura to Leanix ITSM with a single click.

## Features

- **One-click export**: Send diagrams directly to Leanix from the canvas toolbar
- **Smart versioning**: Automatically updates existing diagrams or creates new ones
- **Name-based search**: Finds existing diagrams by name before creating duplicates
- **Visual feedback**: Toast notifications for success, errors, and progress
- **Secure configuration**: Credentials stored via plugin's encrypted storage

## Capabilities

- `network` — API calls to Leanix via proxy
- `ui:panels` — Toolbar button and settings modal
- `ui:overlays` — Toast notifications
- `diagram:read` — Read diagram name for search

## Setup

### 1. Install the Plugin

```bash
cd plugins/structura-plugin-leanix
npm install
npm run build
```

Upload the generated `dist/plugin.js` from the Structura Plugins page.

### 2. Configure Server Proxy

Set these environment variables in your `.env` file:

```env
# Leanix instance base URL
PROXY_REVERSE_LEANIX_URL=https://company.leanix.net

# Optional: fallback auth token for all requests
PROXY_REVERSE_LEANIX_API_TOKEN=your-api-token
```

The server proxy runs at `/leanix` in development mode.

### 3. Configure Plugin Credentials

1. Click the Leanix button in the canvas toolbar
2. Enter your Leanix credentials:
   - **Base URL**: Your Leanix instance (e.g., `https://company.leanix.net`)
   - **Auth Token**: Your Bearer token from Leanix admin
   - **User ID**: Your Leanix user ID for permissions
3. Click Save

## Usage

1. Ensure your diagram has a name
2. Click "Send to Leanix" in the toolbar
3. The plugin searches for an existing diagram with the same name
4. If found: updates the existing diagram
5. If not found: creates a new diagram
6. Click "Open in Leanix" to view the result

## Error Handling

| Error | Action |
|-------|--------|
| Invalid/expired token | Opens settings to update credentials |
| Connection error | Retry button |
| Internal error | Contact Leanix support |

## Files

```
structura-plugin-leanix/
├── manifest.json           # Plugin manifest
├── package.json           # Dependencies
├── vite.config.js         # Build configuration
├── dist/
│   └── plugin.js          # Built plugin (upload this)
└── src/
    ├── index.tsx          # Plugin entry point
    ├── types/             # TypeScript interfaces
    ├── hooks/             # React hooks (config, API)
    ├── components/        # UI components
    ├── services/          # Leanix API service
    └── i18n/              # Internationalization
```
