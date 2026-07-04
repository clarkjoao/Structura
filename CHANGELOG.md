# Changelog

All notable changes to Structura are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `SECURITY.md` with the vulnerability reporting process and this changelog.
- Dependabot config (weekly npm updates for root and `server/`, monthly for Actions).
- Naming and file conventions section in `CONTRIBUTING.md`.

### Changed

- `ROADMAP.md` now tracks the feature backlog; the root `TODO.md` was removed
  (detailed write-ups remain available in git history).
- `server/` runtime dependencies (`cors`, `axios`) moved out of `devDependencies`
  so a production install works.
- The LLM chat UI moved from `src/components/chat/` to `src/features/llm/components/`,
  and `src/integrations/` moved to `src/features/integrations/` — features now
  have a single home.
- Canvas constants consolidated into one `canvas.constants.ts` module.
- Docs: extension-point inventory is now `docs/architecture/extension-points.md`;
  the roadmap analysis is `docs/architecture/roadmap-analysis.md`.

### Removed

- 27 unused npm dependencies and 29 unused shadcn/ui components.
- The unused Radix toast system — [sonner](https://sonner.emilkowal.ski/) is the
  single toast implementation.
- Unused `QueryClientProvider` (no React Query usage exists).
- The superseded pre-OpenSpec `specs/` directory and the stale
  `docs/techinical-review.md`.

## 0.1.0 - 2026-05

Initial public version: C4 diagrams with drill-down, AWS/GCP/Azure catalogs,
flows (recording + playback), journeys, undo/redo, local-first persistence
(localStorage / File System Access API), import/export (JSON, draw.io, Mermaid),
LLM-assisted diagramming, experimental real-time collaboration, and the plugin
system foundation.
