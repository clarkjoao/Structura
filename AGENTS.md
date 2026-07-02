# Structura — Guide for AI Coding Agents

Canonical project context for AI tools (Claude Code, Cursor, Copilot, …).
Editor-specific rules live in `.cursor/rules/structura-*.mdc`; this file is the
single long-form reference they point to.

## What it is

Open source C4-model architecture diagramming SPA. No backend and no database:
all state is client-side (localStorage and, optionally, a local folder via the
File System Access API). A small optional Node server in `server/` provides
collaboration relay and proxying only.

## Tech stack

- React 18 + TypeScript (**strict mode — keep it green**)
- Vite (`@vitejs/plugin-react`), dev server on port 8080
- Zustand + Immer for global state (slice-based store)
- React Flow (`@xyflow/react` v12) for the canvas
- Tailwind CSS + shadcn/ui (regenerate shadcn components via CLI, don't hand-edit `src/components/ui/`)
- lucide-react for icons
- react-i18next — locales `en` and `pt-BR` (pt-BR is the fallback)
- Vitest (unit) + Cypress (`cypress/e2e/stress-*`) for tests
- Prettier (printWidth 100) — CI enforces `npm run format:check`

## Commands

```
npm run dev          # vite dev server (port 8080)
npm run typecheck    # tsc -b (project references; root tsconfig checks nothing by itself)
npm run lint         # eslint
npm run format       # prettier --write
npm run test         # vitest run
npm run build        # tsc -b && vite build
```

## Folder structure

```
src/
├── features/
│   ├── diagram/            # domain layer — types, guards, Zustand store (slices/selectors), utils
│   │                       # no React/JSX here
│   ├── canvas/             # React Flow UI — nodes, edges, toolbar, panels, hooks, flow mode
│   ├── cloud/              # cloud provider registry (AWS/GCP/Azure icons + catalogs)
│   ├── collaboration/      # WebSocket/Yjs collab, presence, patches
│   ├── custom-components/  # user-defined reusable node templates
│   ├── icons/              # custom icon store
│   ├── journeys/           # cross-diagram step sequences + player
│   ├── llm/                # diagram assistant (chat, patch parser, suggestions)
│   └── viewer/             # read-only shared-diagram viewer
├── infrastructure/
│   ├── persistence/        # IStoragePort, LocalStorage/FileSystem/InMemory adapters, sync
│   └── i18n/               # i18next setup + locales
├── pages/                  # route-level components (all lazy-loaded from App.tsx)
├── components/             # shared UI (shadcn/ui under components/ui/)
├── lib/                    # export-service (drawio/mermaid/structurizr), catalogs, utils
└── fixtures/seeds/         # demo workspace content (Portuguese demo data is intentional)
```

## Hard rules

- **Type guards, not raw strings**: `isPanelComponent(c)` / `isPanelType(t)` from
  `@/features/diagram` — never `c.type === "panel"`.
- **No hardcoded user-visible strings**: always `t("key")` with entries in both
  `en.json` and `pt-BR.json`.
- **Language policy**: code, comments, and commit messages in English; UI strings
  through i18n; seed/demo content may stay Portuguese.
- **No `any` / no `as unknown as`**: strict mode is on; use guards or fix the types.
- **Custom nodes are typed**: `NodeProps<Node<MyNodeData>>` where `MyNodeData` is a
  `type` alias (interfaces don't satisfy React Flow's data constraint). Register new
  node types via a `NodeTypeDescriptor` in `features/canvas/nodes/node-types/`.
- **Store changes go through slices** (`features/diagram/store/slices/*`); mutating
  actions that change structure must call `pushHistory` for undo/redo. Persisted
  schema changes need a migration in `persist.config.ts` (bump `PERSIST_SCHEMA_VERSION`).
- **Persistence goes through `IStoragePort`** — never touch `localStorage` directly
  outside `infrastructure/persistence/`.
- **`@` alias** resolves to `./src`.
- Prefer incremental changes; leave the codebase simpler than you found it.
- **Significant features start with a spec** in `specs/` (see `specs/README.md`);
  long-term decisions are recorded in `docs/adr/`.

## Architecture documentation

The rationale behind these rules lives in `docs/` — start with
`docs/architecture/vision.md` (platform direction) and
`docs/architecture/overview.md` (current structure). Subsystem docs are in
`docs/concepts/`, extension-point inventory in `docs/extension-points/`.
When code and docs disagree, the code wins — fix the doc in the same PR.

## Known sharp edges

- `useLocalNodes` (canvas) keeps a local copy of nodes during drags and merges
  store updates back in; it is deliberate (drag performance) and fragile — don't
  refactor casually, it has tests.
- Undo/redo stores full diagram snapshots with coalescing; bounded by
  `MAX_HISTORY_STEPS`.
- The `@/features/diagram` and `@/features/canvas` barrels couple the bundle
  graph; route chunks stay small only if always-mounted code (App shell, journey
  player) imports leaf modules directly instead of the barrels.
