# Structura Plugins

Central repository for all Structura plugins.

## Structure

```
plugins/
├── examples/           # Simple JavaScript plugins (no build required)
│   ├── console-log/    # Diagram change logger + keyboard shortcuts
│   └── mermaid-import/ # Mermaid flowchart importer
├── structura-plugin-example-ui/  # React/TypeScript plugin example
├── structura-plugin-leanix/      # LeanIX integration (export diagrams to LeanIX)
└── README.md           # This file
```

## Quick Start

### Simple JavaScript Plugins

Plugins in `examples/` are plain JavaScript files — no build step needed. Just upload the `.js` file from the Plugins page in Structura.

| Plugin                                     | Capabilities                                      | Description                                         |
| ------------------------------------------ | ------------------------------------------------- | --------------------------------------------------- |
| [console-log](examples/console-log/)       | `events:diagram`, `diagram:read`, `diagram:write` | Logs diagram changes to console, keyboard shortcuts |
| [mermaid-import](examples/mermaid-import/) | `io:importers`                                    | Import Mermaid flowchart files                      |

### React Plugins

React plugins are in individual folders and require a build step. They are written as
**ordinary React** — the host shares its single React instance as a build-time external, so
you `import { useState } from "react"` and use JSX directly (no `getReact()`, no bundled
React). See [structura-plugin-example-ui/README.md](structura-plugin-example-ui/README.md).

| Plugin                                                      | Capabilities                                                            | Description                         |
| ----------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------- |
| [structura-plugin-example-ui](structura-plugin-example-ui/) | `ui:panels`, `ui:overlays`, `diagram:read`, `events:diagram`, `storage` | Toolbar button, toasts, modals demo |

```bash
cd plugins/structura-plugin-example-ui
npm install
npm run build
# Upload dist/plugin.js from Plugins page
```

### Built-in plugins (pre-installed builds)

For a distribution that ships plugins already installed — no manual upload — build the app with
the plugins embedded:

```bash
npm run build:plugins -- structura-plugin-leanix
# or several, comma-separated:
npm run build:plugins -- structura-plugin-leanix,structura-plugin-example-ui
```

This builds each selected plugin (installing its deps if needed), embeds each `dist/plugin.js`
into the app bundle, and produces the normal `dist/` output. Pass `--no-build` to reuse an
existing `dist/plugin.js` instead of rebuilding.

Built-in plugins show up on the Plugins page with a **Built-in** badge. They activate at boot
straight from the bundle (never uploaded, never written to browser storage), so a rebuild that
ships a newer plugin version updates them automatically. Users can disable them but not
uninstall them. A plain `npm run build` ships zero built-in plugins.

## Plugin Capabilities Reference

See [docs/architecture/extension-points.md](../docs/architecture/extension-points.md) for the full extension point inventory.

| Capability          | Description                                                             |
| ------------------- | ----------------------------------------------------------------------- |
| `events:diagram`    | Subscribe to diagram changes via `onDiagramChange`                      |
| `diagram:read`      | Read diagram data via `getDiagram()`                                    |
| `diagram:write`     | Modify diagrams via `updateComponent()`, `moveComponents()`             |
| `io:importers`      | Register file importers via `registerImporter()`                        |
| `io:exporters`      | Register file exporters via `registerExporter()`                        |
| `ui:panels`         | Add panels to toolbar or inspector via `registerPanel()`                |
| `ui:overlays`       | Show toasts and modals via `overlay.showToast()`, `overlay.openModal()` |
| `canvas:node-types` | Register custom node types via `registerNodeType()`                     |

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

### Importer results

An importer returns plain data; the host mints ids, normalizes, and commits the whole import as one
undo step.

```javascript
StructuraPlugin.registerImporter({
  id: "my-plugin/format",
  label: "My format",
  extensions: ["txt"],
  import(contents, ctx) {
    return {
      components: [
        // C4 types, "panel", catalog categories ("aws-database", "oss-messaging", …) and
        // "<pluginId>/<name>" are kept; any other type becomes "unknown".
        { key: "orders", name: "Orders", type: "panel", x: ctx.anchor.x, y: ctx.anchor.y },
        {
          key: "db",
          name: "orders-db",
          type: "aws-database",
          cloudServiceId: "dynamodb", // picks the icon (API 1.3)
          technology: "DynamoDB", // C4 and catalog components (API 1.3)
          parentKey: "orders", // nest in a new or existing component (API 1.3)
          x: 40, // relative to the parent when nested
          y: 40,
        },
      ],
      // source/target: a component key, or an existing component id from ctx.
      connections: [{ source: "db", target: "orders", label: "" }],
      warnings: [],
    };
  },
});
```

A `parentKey` that is missing, names a component that cannot hold this type, or closes a cycle
puts the component at the top level. Connections whose ends cannot be resolved are skipped and
counted.

### React Plugin Setup

See [structura-plugin-example-ui/README.md](structura-plugin-example-ui/README.md)
