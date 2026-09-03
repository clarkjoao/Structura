# Plugin Examples (JavaScript)

Simple JavaScript plugins that require no build step. Upload the `plugin.js` file directly from Structura's Plugins page.

## Available Examples

### console-log

**Capabilities:** `events:diagram`, `diagram:read`, `diagram:write`

- Logs every diagram change to the DevTools console
- **Alt+Shift+O** — Arrange root components in a grid
- **Alt+Shift+U** — Uppercase all component names

**Files:**

- `plugin.js` — The plugin (upload this)
- `README.md` — This file

### mermaid-import

**Capabilities:** `io:importers`

- Imports Mermaid flowchart files (.mmd, .mermaid)
- Supports: `A[Label]`, `B(Label)`, `C{Label}`, `D((Label))`
- Reuses existing components by name

**Files:**

- `plugin.js` — The plugin (upload this)
- `README.md` — This file

## How to Install

1. Open Structura
2. Go to **Plugins** page
3. Click **Install Plugin**
4. Select the `plugin.js` file from any example folder
5. Confirm installation

## Capability Reference

| Capability       | Used By        |
| ---------------- | -------------- |
| `events:diagram` | console-log    |
| `diagram:read`   | console-log    |
| `diagram:write`  | console-log    |
| `io:importers`   | mermaid-import |
