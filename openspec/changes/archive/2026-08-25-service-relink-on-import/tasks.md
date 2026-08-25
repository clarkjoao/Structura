## 1. Manifest type and export

- [x] 1.1 Create `src/features/diagram/model/service-manifest.types.ts` with
      `ServiceManifestEntry` (`id`, `name`, `repositoryUrl`, `technology`, `owner`, `tags`,
      `sources`, `github?: { repoId, fullName }`) and export it from the diagram barrel
- [x] 1.2 `versions.ts` — add optional `services?: ServiceManifestEntry[]` to `VersionedDiagram`
      and to `createVersionedDiagram`
- [x] 1.3 `export-json.ts` — `exportJSON(diagram, serviceCatalog)` collects the referenced
      service ids from `resolved.snapshot.components` (mirroring `resolveUsedIconLibrary`) and
      builds the entries
- [x] 1.4 `build-export-files.ts` — pass the already-available `serviceCatalog` into `exportJSON`
- [x] 1.5 `workspace/index.tsx` — the "Copy JSON" action passes the catalog too, so the
      clipboard payload matches the downloaded file (`exportJSONUnversioned` has no callers
      and keeps its signature)
- [x] 1.6 Tests: only referenced services exported; empty diagram → no manifest; snapshot of the
      envelope shape

## 2. Matcher

- [x] 2.1 Create `src/features/integrations/service-matching.ts` exporting
      `matchServiceEntry(entry, localServices) => { kind: "match", service, signals } |
      { kind: "none" } | { kind: "ambiguous", candidates }`
- [x] 2.2 Implement the five signals, reusing `repoUrlsMatch` / `normalizeRepoUrl` from
      `merge-utils.ts`; add a `normalizeServiceName` helper there if one is needed
- [x] 2.3 Enforce the rule: `signals >= 2` AND unique top scorer
- [x] 2.4 Export `buildFallbackEntries(diagram)` producing synthetic entries from component
      `name` / `externalLinks` / `technology` when the file has no manifest
- [x] 2.5 Export `buildRelinkPlan({ entries, components, localCatalog })` grouping into
      relink / unmatched / already-local
- [x] 2.6 Unit tests: repoId+name → match; name only → none; two equal candidates → ambiguous;
      git@ vs https URL forms; fallback path; entry whose id already exists locally

## 3. Import wiring

- [x] 3.1 `validateWorkspaceFile.ts` — read and validate `services` from the envelope, surface it
      as `ValidationResult.services?`
- [x] 3.2 Create `src/pages/apply-service-relink.ts` — pure rewrite of `component.serviceId`
      across `snapshot.components` and every `scenes[*].addedComponents`, given the accepted
      decisions; returns a new `Diagram`
- [x] 3.3 `useWorkspaceImport.ts` — build the plan after validation; when it is empty, keep the
      current flow untouched; otherwise hold the diagram and surface the plan
- [x] 3.4 Apply the rewrite before `importDiagram` so the import stays one store write
- [x] 3.5 Unit test on `apply-service-relink` including scene components

## 4. Review dialog

- [x] 4.1 Create `src/pages/ServiceRelinkDialog.tsx` — three groups, per-row checkbox, matched
      signals shown per row, "apply all", confirm and cancel
- [x] 4.2 Wire it into `ImportModal.tsx` / `useWorkspaceImport.ts`; cancel aborts the import
- [x] 4.3 New `serviceRelink.*` i18n block in `en.json` and `pt-BR.json`
- [ ] 4.4 Render test for the dialog (deferred — the plan builder and the rewrite are covered
      by unit tests; the dialog is presentation over those)

## 5. Verification

- [x] 5.1 `npm run typecheck && npm run lint && npm run test && npm run format:check`
- [x] 5.2 Round-trip test: export from a fixture workspace, import into another with the same
      service under a different id, assert `serviceId` was remapped
- [ ] 5.3 Manual with two browser profiles: export in A, import in B, confirm the dialog, check
      the element panel shows the local service linked
- [ ] 5.4 Manual: import a pre-change JSON (no `services`) — fallback matches or degrades to
      unmatched, and the import never fails
