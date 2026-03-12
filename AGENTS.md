# AGENTS.md

## Cursor Cloud specific instructions

**Structura** is a client-side C4 architecture diagramming SPA (React + Vite + TypeScript). No backend, database, or external services are required.

### Quick reference

| Action | Command |
|--------|---------|
| Dev server (port 8080) | `npm run dev` |
| Lint | `npm run lint` |
| Tests | `npm run test` |
| Build | `npm run build` |

### Notes

- The UI is in **Brazilian Portuguese**. All labels, buttons, and text are in pt-BR.
- Lint (`npm run lint`) reports 3 pre-existing errors and 7 warnings in generated shadcn/ui components and `tailwind.config.ts`. These are not regressions from current app code.
- All application state is client-side (Zustand + Immer). Seed/demo data is in `src/lib/model-store.ts`.
- `@tanstack/react-query` is configured but not actively used for API calls.
- The Vite dev server binds to port **8080** (configured in `vite.config.ts`).
