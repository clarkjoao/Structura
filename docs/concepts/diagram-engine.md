# Diagram Engine

The diagram engine is the **Model context**: `src/features/diagram/`. It owns
what a diagram *is* — types, invariants, and every mutation. It contains no
React and imports nothing from other features, which is what keeps it
unit-testable and renderer-independent.

## Structure

```
features/diagram/
├── model/       types + guards (component, connection, flow, layout, diagram)
├── store/       Zustand store: slices/, selectors/, persist config, history
├── utils/       pure model operations (traversal, repair, migration,
│                scene mutations, mermaid import, id generation, …)
├── enums.ts     shared enums (PanelKind, EdgeStyle, ExternalLinkType, …)
└── index.ts     the public barrel — the ONLY entry point for other features
```

## The store is the engine

All mutations go through slice actions
(`store/slices/*` — components, connections, flows, folders, scenes,
services, icons, clipboard, history, layout, parenting, links, patterns,
user templates). The composition rules:

- **Immer drafts** — actions mutate a draft; the store stays immutable
  outside.
- **History discipline** — any action that changes *structure* must call
  `pushHistory` so undo/redo works. History stores full `ModelDraft`
  snapshots per diagram with coalescing, bounded by `MAX_HISTORY_STEPS`
  (see [state-management.md](state-management.md)).
- **Persistence discipline** — schema changes require a migration in
  `persist.config.ts` and a `PERSIST_SCHEMA_VERSION` bump
  (see [persistence.md](persistence.md)).
- **Selectors, not state-reaching** — consumers subscribe via
  `store/selectors/*`; reaching into raw state from UI is a smell.

## Why a "no React" domain layer

Three reasons, in priority order:

1. **Testability.** Slice logic, repair utilities, and traversal are tested
   with Vitest with zero rendering machinery.
2. **Renderer independence.** React Flow could be replaced (or supplemented —
   e.g. an SVG static renderer for previews already exists in
   `lib/diagram-preview`) without touching the model.
3. **Future headless use.** Interchange, AI patching, MCP, and validation all
   want to operate on the model without a canvas mounted.

## Model utilities worth knowing

- `flow-repair.ts` / `flow-migration.ts` — flows self-heal when components
  they reference are deleted; migrations upgrade old flow shapes.
- `scene-mutations.ts` / `scene.utils.ts` — applying `SceneDiff`s to a
  snapshot, resolving effective components under an active scene.
- `children-index.ts` — parent→children index used by panels and layout.
- `import-mermaid-flowchart.ts` / `import-mermaid-sequence.ts` — text-to-model
  importers (they live here, not in `lib/export-service`, because they parse
  into model types directly; a future interchange consolidation may move them).
- `generate-id.ts` — the only sanctioned id generator.

## Invariants the engine protects

- A component's `parentId` chain never cycles and always resolves (repair
  utilities enforce this on load).
- Connections always reference existing components (validation on
  import/export via `lib/export-service/validate-diagram.ts`).
- Every mutation that users perceive as "one action" is one history entry
  (coalescing rules in `history.slice.ts`).

## Extension outlook

The engine's closed `ComponentType` union is the platform's main
extensibility bottleneck. The planned remedy is a **domain component
descriptor registry** mirroring the canvas descriptor system — see
[extension-points/README.md](../extension-points/README.md) and
[vision §7](../architecture/vision.md).
