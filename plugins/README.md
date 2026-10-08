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
├── structura-plugin-opscr/       # opscr manifests importer (needs a local opscr: see its README)
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

| Capability          | Description                                                                   |
| ------------------- | ----------------------------------------------------------------------------- |
| `events:diagram`    | Subscribe to diagram changes via `onDiagramChange`                            |
| `diagram:read`      | Read diagram data via `getDiagram()`                                          |
| `diagram:write`     | Modify diagrams via `updateComponent()`, `moveComponents()`                   |
| `io:importers`      | Register file importers via `registerImporter()`                              |
| `io:exporters`      | Register file exporters via `registerExporter()`                              |
| `ui:panels`         | Add panels to toolbar or inspector via `registerPanel()`                      |
| `ui:overlays`       | Show toasts and modals via `overlay.showToast()`, `overlay.openModal()`       |
| `canvas:node-types` | Register custom node types via `registerNodeType()`                           |
| `files:folder`      | Read and write a folder the user picked via `files` (API 1.4)                 |
| `llm:context`       | Answer the chat for diagrams the plugin owns (`registerChatContext`, API 1.6) |

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

### Editing diagrams and folders (API 1.4)

```javascript
// A pane docked beside the canvas, toggled from the canvas toolbar.
api.registerPanel({
  id: "my-plugin/pane",
  slot: "document-pane",
  title: "My pane",
  component: Pane,
});

function Pane() {
  const { CodeEditor } = api.ui; // the host's Monaco; no need to bundle an editor
  return (
    <CodeEditor
      value={text}
      language="yaml"
      onChange={setText}
      onSave={save}
      markers={[{ line: 3, message: "unknown field", severity: "error" }]}
    />
  );
}

// A folder the user picks, remembered per binding id (re-asks permission after a reload).
const folder = (await api.files.open(diagramId)) ?? (await api.files.pick(diagramId));
const names = await folder.list(); // top-level file names
await folder.write("a.yaml", await folder.read("a.yaml"));

// Several diagram changes as one undo step; returns the ids created per key.
const { idsByKey, connectionIds } = api.applyChanges({
  remove: [oldId],
  update: [{ id, name: "orders", technology: "Go", cloudServiceId: "lambda" }],
  move: [{ id, x: 10, y: 20 }],
  add: [{ key: "db", name: "orders-db", type: "aws-database", x: 0, y: 0 }],
  connect: [{ source: id, target: "db", label: "writes" }],
});
```

`files` never exposes the directory handle; names that would leave the folder are rejected.
`applyChanges` normalizes `add` like importer results and ignores ids that are not in the diagram.

### Rename in the code editor (API 1.5)

```javascript
<CodeEditor
  value={text}
  rename={{
    // The renameable symbol at a text offset, or null ("Nothing here can be renamed").
    resolve: (offset) => symbolAt(text, offset), // { start, end, text }
    // Apply it yourself (it may span files); return a message to refuse.
    rename: async (offset, newName) => (taken(newName) ? "Already used" : apply(offset, newName)),
  }}
/>
```

F2 opens Monaco's rename box on the symbol; the provider only answers for this editor.

### Chat context (API 1.6)

```javascript
api.registerChatContext({
  id: "my-plugin/chat",
  // Take over the chat of the diagrams you own (e.g. bound to your files).
  appliesTo: (diagramId) => owned.has(diagramId),
  // Replaces the built-in diagram prompt. `input`: { diagramId, locale, attempt, maxAttempts }.
  systemPrompt: (input) => `You edit my files…\n${currentFiles()}`,
  // The model's full reply: apply it, say what to show, or ask the model to fix something.
  handleReply: async (text, input) => {
    const problems = await applyAndValidate(text);
    return problems.length > 0
      ? { reply: "", retry: `Fix these:\n${problems.join("\n")}` }
      : { reply: "Done." };
  },
});
```

Since API 1.7 a result may carry a `preview`: `{ componentIds, connectionIds, title, keep?, discard? }`.
The host shows those as pending (highlighted, Keep / Discard), fits the canvas to them and adds a
suggestion card. Discard calls `discard`, which may return a message to refuse (shown; the change is
kept); without `discard` only Keep is offered. A new message keeps the previous pending reply.

The host calls the model at most 3 times per user message (`retry` is ignored on the last
attempt). Retry turns are not shown; the thread keeps the user's message and the final `reply`.

### React Plugin Setup

See [structura-plugin-example-ui/README.md](structura-plugin-example-ui/README.md)
