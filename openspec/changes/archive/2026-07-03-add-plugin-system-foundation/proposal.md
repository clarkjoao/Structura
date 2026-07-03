# Proposal: Plugin System Foundation (RFC, spec-only)

## Why

Structura's roadmap item **F-02 (TODO.md, Tier 4 — Architecture Shift)** calls for a third-party plugin system — inspired by draw.io's plugin model — so external developers can extend the canvas and wire Structura to their own tools without forking the repo. Today every extension is hand-written in-tree (`src/integrations/defectdojo`, `src/integrations/github`, the Mermaid import path), which does not scale to a community.

F-02 itself carries the warning that drives this change's shape: **the public API is a contract — once exposed to the open-source community, changing it is expensive.** Per that warning, the API must be designed as an RFC first and validated against 2–3 real use cases before any code is written. This change is that RFC: it fixes the public API surface, the manifest format, the lifecycle, and the trust model, so that the later implementation change can be scoped without re-deciding anything.

## What Changes

- **Spec only — zero implementation.** No files under `src/` are created or modified by this change. The deliverables are the OpenSpec artifacts themselves (this proposal, `design.md`, the `plugin-system` spec delta, `tasks.md`). Implementation is deferred to a later, separate OpenSpec change once this RFC is reviewed and archived.
- Defines the **plugin manifest schema** (name, semver version, author, description, entry point, declared capabilities/permissions, minimum supported Structura API version).
- Defines the **plugin lifecycle**: register → activate → deactivate → uninstall, including clean unregistration of everything a plugin contributed.
- Defines the **versioned public API contract** (`StructuraPlugin.*`), starting from the five methods drafted in TODO.md F-02 (`registerNodeType`, `registerExporter`, `registerImporter`, `registerPanel`, `onDiagramChange`), with each argument shape defined precisely enough to be typed.
- Fixes the **trust model for the MVP**: no sandbox (draw.io precedent) — a plugin is a local JS file the user explicitly loads; that act is informed consent. Plugins must never touch the Zustand store, `IStoragePort`, or React Flow internals directly — only the versioned `StructuraPlugin.*` API. The manifest still _declares_ permissions so a future sandboxed/marketplace model can be introduced without breaking the manifest format.
- Fixes the **distribution model**: MVP = local JS files loaded via the File System Access API / file input (fits the no-backend architecture); official plugins later as npm packages prefixed `structura-plugin-*`.
- Validates the API against **two real use cases**: could today's DefectDojo integration and today's Mermaid import have been built as third-party plugins against this API? (Walkthroughs in `design.md`; gaps found there were fixed in the API design, not just noted.)
- Supersedes the "static compilation only, no runtime loading" stance of `docs/architecture/plugin-system-preparation.md` for the MVP distribution model, by explicit maintainer decision. That document's philosophy (contribution points, capability-scoped context, built-ins as first plugins) is otherwise carried forward.

### Why RFC-first

Changing a shipped public API breaks community plugins and burns trust; the cost of a design mistake is paid by third parties who cannot fix it themselves. Doing this as a spec-only RFC lets the maintainer review and reject cheaply, and lets the two use-case walkthroughs falsify the API on paper before it is a contract.

## Non-Goals

This change deliberately does **not** include:

- **Platform Plugin design detail.** Platform Plugins (new routes/pages, external integrations such as Confluence/Jira, Service Registry fields) get a single "future shape" paragraph in `design.md` and nothing more; their full design is a later change.
- **Sandbox implementation.** The MVP trust model is explicitly no-sandbox; sandboxing (CSP, iframe/worker isolation, signature verification) is documented as a risk-mitigation roadmap item only.
- **npm scaffolding.** No `structura-plugin-*` package template, publishing tooling, or registry work.
- **Code.** No implementation of any kind — no new files or edits under `src/`, no plugin loader, no UI.

## Capabilities

### New Capabilities

- `plugin-system`: the contract for loading, validating, activating, and cleanly removing third-party plugins, and the registration guarantees of each `StructuraPlugin.*` API method.

### Modified Capabilities

<!-- none — this is the first capability spec in openspec/specs/ -->

## Impact

- **No runtime impact now** — nothing under `src/` changes in this RFC.
- **Future implementation change** (scoped by `design.md`) will touch: `src/features/plugins/*` (new), `src/pages/settings/PluginsPage.tsx` (new), `src/features/canvas/nodes/node-types/registry.ts` (expose via plugin API; add unregister support), `src/lib/export-service/index.ts` (registry of importers/exporters), import UI (plugin-registered importers).
- **Docs**: `docs/architecture/plugin-system-preparation.md` is partially superseded (distribution model); `docs/extension-points/README.md` remains the master inventory this spec formalizes the first slice of.
- **Process**: this is the first feature to go through OpenSpec in this repo; its artifacts set the template for future changes.
