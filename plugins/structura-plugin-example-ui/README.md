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
const React = getReact(); // Returns React from host
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

## Troubleshooting

### "React is not defined" Error

This is the most common issue when developing React plugins. The problem is using JSX (`<div>`, `<button>`, etc.) without having `React` in scope.

#### ❌ Wrong Patterns

**JSX at module level:**
```typescript
// This runs when the file is imported, BEFORE getReact() is called
const MyIcon = () => <svg>...</svg>;  // ERROR: React not defined!
```

**Hooks without React prefix:**
```typescript
// The plugin system uses React.useState, not useState
export function MyComponent() {
  const [state, setState] = useState();  // ERROR: useState not defined!
  return <div />;
}
```

#### ✅ Correct Pattern: Factory Function

Use a factory function that obtains React **before** defining components:

```typescript
import { getReact } from "../hooks/usePluginApi";

export function createMyToolbarButton({ context }) {
  // Step 1: Get React FIRST
  const React = getReact();

  // Step 2: Define icons INSIDE (they have React via closure)
  const MyIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16}>
      <circle cx={8} cy={8} r={6} />
    </svg>
  );

  // Step 3: Define internal component (starts with uppercase!)
  function MyToolbarButton() {
    // Step 4: Hooks use React.useState, React.useEffect, etc.
    const [isOpen, setIsOpen] = React.useState(false);

    return (
      <div>
        <button onClick={() => setIsOpen(true)}>
          <MyIcon /> Click me
        </button>
      </div>
    );
  }

  // Step 5: Return the component
  return <MyToolbarButton />;
}

// Step 6: Export wrapper for backwards compatibility
export function MyToolbarButton(props) {
  return createMyToolbarButton(props);
}
```

#### Key Rules

1. **Always call `getReact()` before using JSX**
2. **Define components inside the factory function** (they'll have React in scope via closure)
3. **Use `React.useState`, `React.useEffect`, etc.** instead of the shorthand hooks
4. **Internal component names must start with uppercase** (React convention)

### TypeScript Issues

If you see type errors about React:

```typescript
// Import ReactElement for return types
import type { ReactElement } from "react";

// Export type for component props
export function createMyComponent(props: { context: PanelContext }): ReactElement {
  const React = getReact();
  // ...
}
```

## Build Output

- **Format:** IIFE (Immediately Invoked Function Expression)
- **External:** React is provided by the host, not bundled
- **Build:** `npm run build`

## Related Examples

- [Console Log](../examples/console-log/) — JavaScript-only, no React
- [Mermaid Import](../examples/mermaid-import/) — File importer example
