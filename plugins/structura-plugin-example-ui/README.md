# Example UI Plugin (React)

**Capabilities:** `ui:panels`, `ui:overlays`, `diagram:read`, `events:diagram`, `storage`

A React/TypeScript plugin demonstrating toolbar panels, toast notifications, modal dialogs,
an element-inspector panel, and diagram-change events — written as **ordinary React**.

## Features

- **Toolbar Button** — opens a draggable floating panel (`canvas-toolbar` slot)
- **Toast Notifications** — success / error / warning / info, plus a toast with an action
- **Modal Dialog** — opens a host modal with custom content
- **Settings Panel** — shown in the element inspector when an element is selected
- **Diagram Events** — logs diagram changes (`events:diagram`)
- **Persistent state** — the panel position is saved via `api.storage`

## Installation

```bash
npm install
npm run build     # runs sync-types, then vite build → dist/plugin.js
```

Upload `dist/plugin.js` from the Plugins page in Structura.

```bash
npm run typecheck # type-check against the host contract
```

## Architecture

```
src/
├── index.tsx               # manifest + activate(): registers panels, wires events
├── components/
│   ├── ToolbarButton.tsx   # draggable floating panel (canvas-toolbar slot)
│   ├── SettingsPanel.tsx   # element-inspector panel
│   └── ModalContent.tsx    # modal body
├── hooks/
│   └── usePluginApi.ts     # stashes the host API; showToast/openModal helpers
├── i18n/
│   └── labels.ts           # en / pt-BR labels
└── types/
    └── plugin.types.ts     # AUTO-GENERATED copy of the host contract (do not edit)
scripts/
└── sync-types.mjs          # syncs src/types/plugin.types.ts from the host
```

## How React works here

There is **no bundled React and no `getReact()`**. The host shares its single React instance
as build-time globals (`__REACT__`, `__REACT_JSX_RUNTIME__`); `vite.config.js` externalizes
`react` and the automatic JSX runtime and maps them to those globals. So the plugin reuses the
host's React — hooks work across the boundary — and you write plain React:

```tsx
import { useState } from "react";
import type { PluginPanelProps } from "../types/plugin.types";

export function SettingsPanel({ context }: PluginPanelProps) {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount((c) => c + 1)}>{count}</button>;
}
```

Named hook imports, JSX with the automatic runtime, normal component names — no factory
functions, no `React.createElement`, no `React.useState`.

> Sharing the host's React is what keeps hooks working. Never bundle your own copy of React
> — two React instances silently break `useState`/`useEffect`. That is why `react` is a
> `devDependency` here and marked `external` in the build.

## Types stay in sync with the host

`src/types/plugin.types.ts` is a **generated, verbatim copy** of the host's plugin API
contract (`src/features/plugins/plugin.types.ts`) — the single source of truth. It is refreshed
by `npm run sync-types` (which `npm run build` runs for you). To fail CI when it drifts:

```bash
npm run sync-types:check
```

Edit the host contract and re-sync; never edit the generated file by hand.

## Registering panels

```tsx
api.registerPanel({
  id: "example-toolbar-button",
  slot: "canvas-toolbar", // or "element-inspector"
  title: { en: "Example", "pt-BR": "Exemplo" },
  component: ToolbarButton, // (props: PluginPanelProps) => JSX
});
```

Every panel receives a `PluginPanelContext` (`context.locale`, `context.isEditMode`,
`context.selection`, `context.updateComponent`, …), the same shape for every slot.

## Toasts, modals, and storage

```tsx
import { showToast, openModal, getApi } from "../hooks/usePluginApi";

showToast({ type: "success", title: "Saved!", description: "Your changes were saved" });

openModal({
  title: "My Modal",
  content: ({ onClose }) => <MyModalBody onClose={onClose} />,
  size: "md",
});

await getApi().storage.set("my-key", { some: "state" }); // per-plugin persistent storage
```

Host surfaces (panels, toolbar items, modal content) are each rendered inside an error
boundary — a crash in your plugin shows a small fallback instead of taking down the app.

## Styling

Use the host's Tailwind theme tokens (`bg-card`, `text-foreground`, `border-border`,
`bg-muted`, `text-muted-foreground`, `bg-primary`, …) so your UI follows light/dark mode.
Avoid hardcoded colors.

## Related examples

- [Console Log](../examples/console-log/) — JavaScript-only, no React
- [Mermaid Import](../examples/mermaid-import/) — file importer example
