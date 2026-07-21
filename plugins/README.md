# Structura Plugins

Central repository for all Structura plugins.

## Structure

```
plugins/
├── examples/           # Simple JavaScript plugins (no build required)
│   ├── console-log/    # Diagram change logger + keyboard shortcuts
│   └── mermaid-import/ # Mermaid flowchart importer
├── structura-plugin-example-ui/  # React/TypeScript plugin example
├── structura-plugin-leanix/     # Leanix ITSM integration
└── README.md           # This file
```

## Quick Start

### Simple JavaScript Plugins

Plugins in `examples/` are plain JavaScript files — no build step needed. Just upload the `.js` file from the Plugins page in Structura.

| Plugin | Capabilities | Description |
|--------|-------------|-------------|
| [console-log](examples/console-log/) | `events:diagram`, `diagram:read`, `diagram:write` | Logs diagram changes to console, keyboard shortcuts |
| [mermaid-import](examples/mermaid-import/) | `io:importers` | Import Mermaid flowchart files |

### React Plugins

React plugins are in individual folders and require a build step. They are written as
**ordinary React** — the host shares its single React instance as a build-time external, so
you `import { useState } from "react"` and use JSX directly (no `getReact()`, no bundled
React). See [structura-plugin-example-ui/README.md](structura-plugin-example-ui/README.md).

| Plugin | Capabilities | Description |
|--------|-------------|-------------|
| [structura-plugin-example-ui](structura-plugin-example-ui/) | `ui:panels`, `ui:overlays`, `diagram:read`, `events:diagram`, `storage` | Toolbar button, toasts, modals demo |
| [structura-plugin-leanix](structura-plugin-leanix/) | `network`, `ui:panels`, `ui:overlays`, `diagram:read` | Export diagrams to Leanix ITSM |

```bash
# Example UI plugin
cd plugins/structura-plugin-example-ui
npm install
npm run build
# Upload dist/plugin.js from Plugins page

# Leanix plugin
cd plugins/structura-plugin-leanix
npm install
npm run build
# Upload dist/plugin.js from Plugins page
```

## Plugin Capabilities Reference

See [docs/architecture/extension-points.md](../../docs/architecture/extension-points.md) for the full extension point inventory.

| Capability | Description |
|------------|-------------|
| `events:diagram` | Subscribe to diagram changes via `onDiagramChange` |
| `diagram:read` | Read diagram data via `getDiagram()` |
| `diagram:write` | Modify diagrams via `updateComponent()`, `moveComponents()` |
| `io:importers` | Register file importers via `registerImporter()` |
| `io:exporters` | Register file exporters via `registerExporter()` |
| `ui:panels` | Add panels to toolbar or inspector via `registerPanel()` |
| `ui:overlays` | Show toasts and modals via `overlay.showToast()`, `overlay.openModal()` |
| `canvas:node-types` | Register custom node types via `registerNodeType()` |

## Developing Plugins

### JavaScript Plugin Template

```javascript
(function () {
  "use strict";

  window.StructuraPlugin.define({
    manifest: {
      id: "my-plugin",
      name: "My Plugin",
      version: "1.0.0",
      author: "Your Name",
      description: "What this plugin does",
      apiVersion: "^1.0",
      capabilities: ["events:diagram"], // See reference above
    },

    activate: function (api) {
      console.log("My plugin activated!");
      // Your plugin logic here
    },

    deactivate: function () {
      // Cleanup if needed
    },
  });
})();
```

### React Plugin Setup

See [structura-plugin-example-ui/README.md](structura-plugin-example-ui/README.md)
