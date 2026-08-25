## Why

Sharing a diagram breaks its service links.

Structura is stateless and client-side: every workspace mints its own service ids
(`generateId("svc")` in `src/features/diagram/store/slices/services.slice.ts:98`). A component
stores only `serviceId`. `exportJSON` (`src/lib/export-service/export-json.ts:7`) does not export
the service catalog at all, so the JSON leaves with an id that means nothing anywhere else. On
the receiving side the very same service usually *does* exist — same name, same GitHub repo —
under a different local id, and the link is silently lost: the component renders unlinked with no
indication that it ever pointed at anything.

The repository already has the matching primitives for exactly this problem on the GitHub import
path (`repoUrlsMatch` / `normalizeRepoUrl` in `src/features/integrations/merge-utils.ts`,
`detectConflicts` in `github/detectMergeConflicts.ts`), but nothing applies them at diagram
import time.

## What Changes

1. **The export carries a service manifest.** `exportJSON` embeds a `services` array in the
   `VersionedDiagram` envelope, containing only the services actually referenced by
   `snapshot.components[*].serviceId` — the same "only what is used" rule
   `resolveUsedIconLibrary` already applies to icons. Each entry carries the identity signals a
   matcher needs: `id`, `name`, `repositoryUrl`, `technology`, `owner`, `tags`, `sources`, and
   `github: { repoId, fullName }` when present. It is an **optional** field on the envelope, so
   `DIAGRAM_SCHEMA_VERSION` does not move and older readers ignore it.
2. **A matcher that requires corroboration.** A new
   `src/features/integrations/service-matching.ts` scores a manifest entry against the local
   catalog on five independent signals: GitHub `repoId`, normalized repository URL, normalized
   name, normalized `fullName`, and a component `externalLink.url` pointing at a local service's
   repository. A local service is a match only with **two or more distinct signals** *and* only
   if it is the unique top scorer — a tie is reported as no match rather than guessed.
3. **A review dialog on import.** When a plan has anything to remap, the import shows the
   proposal grouped into *relink* (checked by default, showing which signals matched), *no match*
   (with the option to clear the dangling `serviceId`), and *already local* (nothing to do), plus
   an "apply all". The user confirms; nothing is remapped behind their back.
4. **A fallback for files exported before this change.** With no manifest, a synthetic entry is
   built from the component itself — `name`, `externalLinks`, `technology` — which
   `linkComponentToService` already copies onto the component
   (`services.slice.ts:21-37`). The same two-signal rule applies, so the weaker input simply
   produces fewer matches rather than wrong ones.
5. **One store write.** The remapping is applied to the in-memory `Diagram` (including
   `scenes[*].addedComponents`, the way `syncLinkedComponentsFromRegistry` walks them) *before*
   `importDiagram`, so the import stays a single write with no undo-history noise.

## Non-Goals

- Creating local services for unmatched entries. Importing a diagram must not silently populate
  the service catalog; the user can register the service and relink from the element panel.
- Merging field values between a matched local service and the manifest entry. The local service
  wins; only `component.serviceId` is rewritten.
- Changing the GitHub / DefectDojo import paths, `detectConflicts`, or the service catalog page.
- Exporting the full workspace catalog, or exporting services in the drawio / mermaid formats.
- Retroactively fixing diagrams already imported with broken links (a catalog-side "reconcile"
  action is a possible follow-up).

## Capabilities

### New Capabilities

- `service-relink-on-import`: diagram exports carry the identity of the services they reference,
  and importing a diagram reconciles those references against the receiving workspace's catalog
  under explicit user review.

## Impact

- **New files**: `src/features/integrations/service-matching.ts` (+ test),
  `src/features/diagram/model/service-manifest.types.ts`,
  `src/pages/ServiceRelinkDialog.tsx`, `src/pages/apply-service-relink.ts` (+ test).
- **Modified files**: `src/lib/export-service/export-json.ts` (signature gains the catalog),
  `src/lib/export-service/build-export-files.ts` (pass the catalog through — it already receives
  it), `src/infrastructure/persistence/versions.ts` (`VersionedDiagram.services?`),
  `src/infrastructure/persistence/validateWorkspaceFile.ts` (`ValidationResult.services?`),
  `src/pages/useWorkspaceImport.ts`, `src/pages/ImportModal.tsx`,
  `src/infrastructure/i18n/locales/en.json`, `src/infrastructure/i18n/locales/pt-BR.json`.
- **No new dependencies.** No `PERSIST_SCHEMA_VERSION` and no `DIAGRAM_SCHEMA_VERSION` bump —
  the manifest is an additive optional envelope field.
- **i18n**: a new `serviceRelink.*` block in both locales.
- **Privacy note**: the manifest exports service names and repository URLs inside the diagram
  file. Those already travel in the file today as component names, descriptions and
  `externalLinks`, so the change adds no new class of data to a shared export.
