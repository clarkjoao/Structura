# Design

## Context

- `runPluginImport` builds components itself and commits them with `importDrawioResult`: C4 and
  plugin types survive, everything else becomes `unknown`, `parentId` is always null, and the write
  ignores an open diagram version.
- `insertGeneratedGraph` (the LLM generator's path) already does what a structured import needs:
  builds any registered type through its descriptor (`buildComponentForType`), writes `cloudServiceId`
  through the descriptor, nests with `canContain`, sets `technology` on C4/cloud components, commits
  once with `pushHistory`, and writes to the active version scene. It resolves parents and edge
  endpoints only within its own batch.

## Goals / Non-Goals

**Goals:**

- One commit path for "a graph produced outside the store", shared by the generator and plugin imports.
- Additive API: a 1.2 importer's result means exactly what it meant before.

**Non-Goals:**

- Validating `cloudServiceId` against the family's catalog: an unknown service already degrades to
  the category icon at render time.

## Decisions

**Route plugin imports through `insertGeneratedGraph`.** `runPluginImport` keeps building the
`ImportContext` and calling the handler, then maps each `PluginComponentInput` to a
`GeneratedNodeInput` (`key` → `externalId`, `parentKey` → `parentExternalId`) and commits with one
call. Alternative: teach `importDrawioResult` nesting and catalog types — a second copy of logic that
already exists and is tested.

**`insertGeneratedGraph` gains `{ linkExisting: true }`.** With it, a parent or edge endpoint that is
not in the batch resolves against the active diagram's components (and the open scene's), the
behaviour plugin connections already had. Off by default, so the generator cannot accidentally bind
an IR id to an existing component id. It also gains an optional `description`, which plugin inputs
carry and generated nodes do not.

**Type policy in the runner, by registry, not by list.** Keep the type when it is C4, `panel`,
plugin-namespaced, or an element whose family is a registered catalog family; otherwise `unknown`.
Asking the element registry means a family registered later (k8s, oss, a future one) is accepted
without editing this rule. Other registered built-ins stay out: they carry semantics (an endpoint's
handlers, a note's text) that a bare name cannot express.

**Parent cycles are cut in the runner.** `insertGeneratedGraph` trusts its input (the IR validator
rejects cycles first). The runner walks each `parentKey` chain inside the batch and drops the key that
closes a loop, so the store never sees one. A missing parent key is left to `insertGeneratedGraph`,
which already places the node at the top level.

**Connections skipped are counted from the result.** `skippedConnections` = connections returned −
connections created, which now also counts edges out of a type that cannot be a source.

**Version `1.3.0`.** Minor bump: new optional fields only. Type copies in plugins are refreshed with
their `sync-types` scripts, which CI checks.

## Risks / Trade-offs

- [Imports now honour an open diagram version where they wrote to the base before] → it is the
  behaviour every other insert path has; called out in the changelog.
- [A plugin can create many panels] → same bound as any import; `MAX_HISTORY_STEPS` is unaffected
  because the import is one step.
