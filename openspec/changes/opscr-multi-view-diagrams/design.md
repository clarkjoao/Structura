# Design

## Context

- The plugin binds one diagram to one workspace; `ImportResult` is `{components, connections,
  warnings}`; reconcile/patches map canvas edits to YAML ranges keyed by `Kind/name`.
- `Component.linkedDiagramId` already drives drill-down in the host.
- An element can now appear in several diagrams, so `Kind/name` is no longer a unique canvas key.

## Decisions

1. **Canvas key = `View/Kind/name`.** Reconcile, tombstones and the source index key by the view as
   well. A view-less workspace uses the empty view, so existing bindings keep working.
2. **Selection comes from opscr.** The plugin calls `resolveView` and never re-derives scope or edge
   lifting; Structura adds only layout (ELK via `opscr-layout`, seeded by the sidecar).
3. **Layout sidecar v2** `{version: 2, views: {<view>: {<Kind/name>: box}}}`; v1 is read as the
   default view. Writing always produces v2 once the workspace has a View.
4. **One binding, many diagrams.** The host binds a workspace *set* of diagrams; the plugin owns
   their creation. A removed View keeps its diagram, marked orphaned, to avoid silent data loss.
5. **Canvas edits in a derived diagram:** moving or resizing writes the sidecar; editing text on an
   element patches the one manifest that defines it; adding or deleting elements is allowed only in
   the default diagram until Views can express it (the pane says why).

## Risks

- Reconcile complexity grows with the new key → keep the view-less path byte-identical and cover it
  with the existing tests before adding the view path.
- Host change (multi-diagram binding) is the biggest piece → land it behind plugin API 1.13 with a
  fake plugin in tests first.

## Decided

- Orphaned diagrams are deleted only after the user confirms (decided 2026-10-24).
- The contract with opscr is `openspec/changes/architecture-views/contract.md` in the opscr repo; `resolveView` is implemented there (opscr commit `0d69c15`).
