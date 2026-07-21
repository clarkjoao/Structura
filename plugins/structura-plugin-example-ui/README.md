# Example UI Plugin (React)

**Capabilities:** `ui:panels`, `ui:overlays`, `diagram:read`, `events:diagram`

Demonstrates the React-based plugin system with toolbar buttons, toast notifications, and modal dialogs.

## Features

- **Toolbar Button:** Button in the canvas toolbar with sub-actions
- **Toast Notifications:** Success, error, warning, info toasts
- **Modal Dialogs:** Opens a modal with custom content
- **Settings Panel:** Shows in the element inspector when an element is selected
- **Diagram Events:** Logs diagram changes (demonstrates `events:diagram` capability)

## Installation

```bash
# Install dependencies
npm install

# Build the plugin
npm run build
```

Upload `dist/plugin.js` from the Plugins page in Structura.

## Plugin Architecture

```
src/
├── index.tsx          # Plugin entry point, manifest, activate()
├── components/
│   ├── ToolbarButton.tsx   # Main toolbar button component
│   ├── ModalContent.tsx    # Modal content component
│   └── SettingsPanel.tsx   # Element inspector panel
├── hooks/
│   └── usePluginApi.ts     # API helpers (getReact, showToast, etc.)
├── i18n/
│   └── labels.ts           # i18n labels (en, pt-BR)
└── types/
    └── plugin.ts           # TypeScript types
```

## Key Concepts

### React Dependency Injection

The plugin receives React from the host via `api.dependencies.react`:

```typescript
// In plugin manifest
uses: ["react"]

// In hook
const React = getReact(); // Returns window.React from host
```

### Panel Registration

```typescript
api.registerPanel({
  id: "example-toolbar-button",
  slot: "canvas-toolbar", // or "element-inspector"
  title: { en: "Example", "pt-BR": "Exemplo" },
  component: ToolbarButton,
});
```

### Toast Notifications

```typescript
showToast({
  type: "success",
  title: "Saved!",
  description: "Your changes were saved",
  duration: 3000,
});
```

### Modal Dialogs

```typescript
openModal({
  title: "My Modal",
  content: MyModalContent,
  size: "md",
});
```

## Build Output

- **Format:** IIFE (Immediately Invoked Function Expression)
- **Size:** ~7.5 KB (gzipped)
- **External:** React is provided by the host, not bundled

## Related Examples

- [Console Log](../examples/console-log/) — JavaScript-only, no React
- [Mermaid Import](../examples/mermaid-import/) — File importer example
