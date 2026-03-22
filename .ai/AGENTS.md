# AGENTS.md — Structura

Entry point for all AI agents (Cursor, Claude Code, Copilot, etc.).
Read this file first, then the skill files relevant to your task.

---

## Project

**Structura** is an open source C4 architecture diagramming SPA.
Stack: React 18 + TypeScript (strict) · Vite · Zustand + Immer · React Flow · Tailwind · shadcn/ui · react-i18next

No backend, database, or external services. All state is client-side.

---

## Commands

| Action | Command |
|--------|---------|
| Dev server (port 8080) | `npm run dev` |
| Lint | `npm run lint` |
| Tests | `npm run test` |
| Single test file | `npx vitest run src/test/example.test.ts` |
| Build | `npm run build` |

> `npm run lint` reports 3 pre-existing errors and 7 warnings in generated shadcn/ui files and `tailwind.config.ts`. These are not regressions — do not fix them.

---

## Key facts

- `@` alias resolves to `./src` (configured in `vite.config.ts`)
- UI language: **pt-BR** default, **en** secondary — no hardcoded user-facing strings
- Seed/demo data: `src/fixtures/seed.ts` — only used when localStorage is empty
- `@tanstack/react-query` is installed but not actively used
- `components` inside a `Diagram` is a **discriminated union** — always use type guards (`isPanelComponent`, `isC4Component`, etc.) from `@/features/diagram`, never `type === "panel"` directly

---

## Architecture at a glance

```
src/
├── features/
│   ├── diagram/       # domain layer — types, store, slices, selectors. No React, no UI.
│   ├── canvas/        # UI layer — React Flow, nodes, edges, toolbar, panels, flows
│   └── registry/      # ServiceDefinition + registry store
├── infrastructure/
│   └── persistence/   # IStoragePort, LocalStorageAdapter, InMemoryAdapter
├── pages/             # Dashboard, ModelExplorer, ServiceRegistry, Index
├── components/        # shared UI (shadcn/ui + Navbar)
└── lib/               # aws-catalog, export-service, github-import, utils
```

Full architecture, data model and roadmap: see `.ai/CONTEXT.md`

---

## Skill index — read before coding

| Task | Skill file |
|------|------------|
| Creating a new feature (FSD) | `.ai/skills/new-feature.md` |
| Adding a new node type to the canvas | `.ai/skills/new-node-type.md` |
| Zustand slices, selectors, history | `.ai/skills/store-patterns.md` |
| Naming, TypeScript, anti-patterns | `.ai/skills/code-standards.md` |
| Adding i18n strings and translations | `.ai/skills/i18n.md` |

---

## Deprecated — do not import from these

- `src/lib/model-types.ts` → use `@/features/diagram`
- `src/lib/model-store.ts` → use `@/features/diagram`
