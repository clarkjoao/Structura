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

- **i18n**: `react-i18next` with locales in `src/infrastructure/i18n/locales/` (`pt-BR` default, `en`). Browser language detection + `localStorage` key `structura_language`. Language switcher in the Navbar.
- The UI copy is maintained in translation files; default locale is **pt-BR** with **en** as secondary.
- Lint (`npm run lint`) reports 3 pre-existing errors and 7 warnings in generated shadcn/ui components and `tailwind.config.ts`. These are not regressions from current app code.
- All application state is client-side (Zustand + Immer). Seed/demo data is in `src/fixtures/seed.ts`.
- `@tanstack/react-query` is configured but not actively used for API calls.
- The Vite dev server binds to port **8080** (configured in `vite.config.ts`).
