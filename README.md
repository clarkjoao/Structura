# Structura

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-18-61dafb.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6.svg)
![Status](https://img.shields.io/badge/status-active-brightgreen.svg)

**Architecture diagramming for teams who think in systems.**

<!-- screenshot -->

---

## What is Structura?

Structura is an open source architecture diagramming tool built around the [C4 Model](https://c4model.com/) — a hierarchical approach to describing software systems at four levels of abstraction: Context, Container, Component, and Code. Structura focuses on the first three, giving teams a shared visual language for communicating architecture decisions.

Beyond static diagrams, Structura supports **flows**: named sequences of interactions across your components that can be recorded, played back step-by-step, and exported to Mermaid sequence diagrams. This lets you document not just the structure of a system, but the dynamic behavior — API calls, event flows, data pipelines — directly on the same canvas.

Structura also includes a built-in **AWS service catalog** so cloud-native teams can annotate components with real service types (Lambda, S3, RDS, and more) and keep diagrams close to the infrastructure they describe.

---

## Features

- **C4 Model levels** — Context, Container, and Component diagrams in a single workspace, with drill-down navigation between levels
- **AWS Services catalog** — 80+ AWS service types for annotating components with real infrastructure
- **Flow recording & playback** — Record interaction sequences as flows, replay them step-by-step, and track coverage across your diagram
- **Pattern library** — Reusable component panels and grouping to express architectural patterns
- **Undo / Redo** — Full history stack scoped to each diagram
- **Export** — Export to JSON, draw.io XML, or Mermaid sequence diagrams
- **Dark / Light theme** — Toggle between themes from the navigation bar
- **Folder organization** — Organize diagrams into nested folders on the dashboard

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI Framework | [React 18](https://react.dev/) |
| Language | [TypeScript 5](https://www.typescriptlang.org/) |
| State Management | [Zustand](https://zustand-demo.pmnd.rs/) + Immer |
| Canvas | [@xyflow/react](https://reactflow.dev/) (React Flow) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) + shadcn/ui |
| Build | [Vite](https://vitejs.dev/) |
| Tests | [Vitest](https://vitest.dev/) |

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
git clone https://github.com/your-org/structura.git
cd structura/frontend
npm install
```

### Development

```bash
npm run dev        # Start dev server at http://localhost:8080
npm run build      # Production build
npm run lint       # Run ESLint
npm run test       # Run tests
```

The `@` path alias resolves to `./src`.

---

## Project Architecture

```
src/
├── features/
│   ├── diagram/       # Core data model, Zustand store, types, guards
│   ├── canvas/        # ReactFlow canvas, node descriptors, hooks
│   ├── flows/         # Flow re-exports
│   └── registry/      # Service definition registry
├── infrastructure/
│   └── persistence/   # Storage adapters (LocalStorage, InMemory)
├── components/ui/     # shadcn/ui component library
├── fixtures/          # Seed data for development
├── hooks/             # Shared app hooks (useTheme, use-toast, use-mobile)
└── lib/               # Export utilities, AWS catalog, GitHub import
```

### Diagram Store (`features/diagram`)

The single source of truth is `useDiagramStore`, a Zustand store with Immer mutations and localStorage persistence. It is split into focused slices:

| Slice | Responsibility |
|-------|---------------|
| `diagram` | Diagram CRUD, active diagram, drill-down navigation |
| `components` | Add, update, remove, parent, group components |
| `connections` | Manage edges between components |
| `flows` | CRUD for named interaction flows |
| `layout` | Node positions, dimensions, viewport, z-order |
| `services` | Service registry and component-service linking |
| `clipboard` | Copy/paste within and across diagrams |
| `history` | Undo/redo via past/future snapshot stacks |
| `folders` | Nested folder hierarchy for the dashboard |
| `patterns` | Insert pattern templates onto the canvas |

Each `Diagram` snapshot stores components as a **discriminated union** (`C4Component | PanelComponent | NoteComponent | AwsComponent`). Use the provided type guards (`isC4Component`, `isPanelComponent`, etc.) instead of checking `type` directly.

### Canvas (`features/canvas`)

`Canvas.tsx` bridges the diagram store to ReactFlow. Node rendering is driven by a **descriptor registry** — each node type implements `NodeTypeDescriptor` and registers itself. To add a new node type, see [`src/features/canvas/nodes/node-types/README.md`](src/features/canvas/nodes/node-types/README.md).

Key hooks:

| Hook | Purpose |
|------|---------|
| `useCanvasStore` | Centralised access to store data and actions |
| `useCanvasNodes` | Derives ReactFlow `Node[]` from visible components |
| `useCanvasEdges` | Derives ReactFlow `Edge[]` from visible connections |
| `useNodeDragParenting` | Handles drag-to-panel parenting and unparenting |
| `useCanvasKeyboard` | Orchestrates all canvas keyboard shortcuts |
| `useCanvasVisualState` | Selection, highlights, context menu state |
| `useCanvasEffects` | Side-effects: viewport sync, layout persistence |
| `useFlowState` | Computes playback highlights and coverage overlays |

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on opening issues, submitting pull requests, and the code style conventions used in this project.

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

## Embedding a diagram

### HTML

```html
<iframe id="structura" src="https://app.structura.dev/embed" height="500"></iframe>
<script>
  const iframe = document.getElementById("structura");
  const diagram = /* your diagram JSON */;
  iframe.addEventListener("load", () => {
    iframe.contentWindow.postMessage(
      { type: "STRUCTURA_LOAD", diagram },
      "https://app.structura.dev"
    );
  });
</script>
```

### React / Docusaurus

```jsx
import { useEffect, useRef } from "react";
import diagram from "./my-diagram.json";

export function ArchitectureDiagram() {
  const ref = useRef(null);

  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;
    const send = () => iframe.contentWindow.postMessage(
      { type: "STRUCTURA_LOAD", diagram },
      "https://app.structura.dev"
    );
    iframe.addEventListener("load", send);
    return () => iframe.removeEventListener("load", send);
  }, []);

  return <iframe ref={ref} src="https://app.structura.dev/embed" height={500} />;
}
```

### StructuraEmbed helper

You can also use the helper component in this repository:

```tsx
import { StructuraEmbed } from "@/components/StructuraEmbed";
import diagram from "./my-diagram.json";

export function ArchitectureDiagram() {
  return (
    <StructuraEmbed
      diagram={diagram}
      appOrigin="https://app.structura.dev"
      height={500}
    />
  );
}
```
