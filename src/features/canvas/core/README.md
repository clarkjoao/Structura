# Canvas Core

Shared diagram surface for Write Host (`Canvas.tsx`), Reader Host
(`ViewerCanvas.tsx`), and a future Plugin Host.

## Public surface

Import from `@/features/canvas/core` (or the main `@/features/canvas` barrel):

| Export                                                                       | Role                                                 |
| ---------------------------------------------------------------------------- | ---------------------------------------------------- |
| `DiagramSurface`                                                             | React Flow shell, providers, Background, edge portal |
| `readPolicy` / `writePolicy`                                                 | Cohesive interaction policy                          |
| `buildReactFlowShellProps`                                                   | RF prop defaults from policy                         |
| `projectReadDiagram` / `useReadDiagramFlow`                                  | Reader IR → RF projection (golden source)            |
| `buildReadNodeContext`                                                       | Read-only `NodeBuildContext`                         |
| `DiagramFlowProvider` / `useDiagramFlow`                                     | Provider / instance without leaking `@xyflow/react`  |
| `DiagramControls` / `DiagramMiniMap` / `DiagramPanel` / `DiagramNodeToolbar` | RF chrome re-exports                                 |
| `DiagramNode` / `DiagramNodeComponent` / `DiagramNodeTypes`                  | Type-only RF contracts for siblings                  |

## Reader projection golden source

Do **not** add viewer-side re-exports of the projection. Import:

```ts
import {
  useReadDiagramFlow,
  projectReadDiagram,
  buildReadNodeContext,
} from "@/features/canvas/core";
```

## Policy

```ts
writePolicy(canEditCanvas); // kind: "write", graphInteractive
readPolicy(); // kind: "read", graphInteractive: false
```

Mode decides _what_ is allowed. Input profiles (editor custom wheel vs reader
native pan/zoom) stay different until a deliberate product decision converges
them — both paths go through `buildReactFlowShellProps`.

## Hosts / siblings must not

- Import `@xyflow/react` directly (ADR-0001)
- Deep-import canvas internals; use `core`, `flow`, `layout`, `nodes/node-types`
- Put LLM / toolbar / share chrome inside `DiagramSurface`
