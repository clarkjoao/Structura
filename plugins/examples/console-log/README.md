# Console Log Plugin

**Capabilities:** `events:diagram`, `diagram:read`, `diagram:write`

Logs every diagram change to the DevTools console and provides keyboard shortcuts.

## Features

- **Console logging:** Every committed change is logged with a structured diff
  - Components added/removed/renamed/moved
  - Connections added/removed
- **Keyboard shortcuts:**
  - `Alt+Shift+O` — Arrange root components in a grid
  - `Alt+Shift+U` — Uppercase all component names

## Installation

1. Open Structura
2. Go to Plugins page
3. Click Install Plugin
4. Select this `plugin.js` file
5. Confirm

## How It Works

The plugin subscribes to diagram changes via `api.onDiagramChange()` and compares snapshots to generate diffs. Keyboard shortcuts use `document.addEventListener` directly.

## Source

See `examples/plugins/console-log-plugin.js` in the Structura repo for the annotated source.
