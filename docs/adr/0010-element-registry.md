# ADR-0010 — Element registry as the single owner of canvas types

**Status:** Accepted

## Context

Canvas vocabulary (C4, structural shapes, cloud categories, Kubernetes, OSS)
used to be split across many owners: a linear `NODE_TYPE_REGISTRY` with a C4
catch-all, a hand-maintained `BUILTIN_COMPONENT_TYPES` sanitizer list, per-cloud
UI/export/LLM catalogs, and ad-hoc construction branches in the store. Adding a
type meant touching a dozen files; omitting one failed silently (wrong size,
palette gap, type rewritten to `"component"`).

[ADR-0005](0005-extension-philosophy.md) already committed to descriptor
registries. This ADR records the domain-level registry that closes that gap for
**node / element types**.

## Decision

1. **`ElementDescriptor` is the unit of contribution.** One plain object owns
   model construction, canvas render (`rfType`, handles, style builders), export
   mapping, palette metadata, and (when relevant) cloud service attachment.
2. **`elementRegistry` is the single owner for built-ins.** Creation, render
   resolution, sanitize, palette, and LLM validity consult the registry. The
   legacy `NODE_TYPE_REGISTRY` array stays only for **plugin** descriptors via
   `registerDescriptor`.
3. **`CloudFamilyDefinition` + `registerCloudFamily`** is how catalog families
   (AWS, GCP, Azure, Kubernetes, OSS, …) land: categories become element
   descriptors; cloud provider adapters are derived from the same registration.
4. **Unknown types resolve to `unknown`**, not to C4. Prefix recovery
   (`aws-` / `gcp-` / `azure-` → `*-general`) is the only soft fallback.
5. **Persisted cloud service id is `cloudServiceId`.** Reads stay tolerant of
   unmigrated payloads (`resolveCloudServiceId`: `cloudServiceId ?? awsService ??
   gcpService ?? azureService`). Writes use `cloudServiceId` only
   (`PERSIST_SCHEMA_VERSION` 13). This is **not** the business-catalog
   `BaseComponent.serviceId` — that field is never a fallback for cloud
   resolution (a lone catalog link used to leak into the LLM serializer as
   `awsService="svc-pay"`).
6. **Vendored icon packs keep an explicit license file** next to the assets
   (e.g. Kubernetes community unlabeled SVGs under Apache-2.0 — see
   `src/features/elements/families/k8s/ICONS_LICENSE.md`).

## Consequences

- (+) One registration path for structural, C4, and cloud families; single-owner
  invariant tests lock it.
- (+) Catch-all removal makes lookup O(1) on the registry map; no silent C4
  rewrite for corrupted types.
- (+) New cloud families can call `registerCloudFamily` without widening closed
  unions for every category id (open family ids after the contract-close work).
- (−) **The IR does not read the element registry, by decision.** F5c derived
  the AWS category semanticTypes from `allElements()`; that shipped broken. The
  LLM feature is its own Vite chunk, the registry snapshot taken at chunk load
  was empty there, and the allowlist came out boundaries-only — so production
  rejected every `aws-compute` IR while vitest stayed green. `42ec226` reverted
  it to the static `AWS_CATEGORIES` catalog.

  Treat that as the standing decision, not as an accident to tidy up: the IR
  vocabulary is deliberately independent of bootstrap timing. `ir.types.test.ts`
  compares the catalog against the live registry so the two cannot drift, and
  `cypress/e2e/ir-generation-smoke.cy.ts` is what covers the chunk boundary —
  no unit test can, because it runs in one module graph where bootstrap has
  always run.
- (−) **F6b cutover — taken on 2026-09-20, gate removed.** Schema v13 /
  `cloudServiceId` writes were held behind a build gate until F6a tolerant reads
  had been live long enough for every client to upgrade: mixed collab rooms
  (legacy field writers vs `cloudServiceId` writers) diverge on snapshot
  checksums, and there is no component-schema version on the wire to negotiate
  it. `cloudServiceIdReleaseGate` in `vite.config.ts` aborted `npm run build`
  unless `VITE_ENABLE_CLOUD_SERVICE_ID_WRITE=true` was set deliberately.

  **The decision was taken on 2026-09-20 and the gate deleted**, on these facts:

  - F6a tolerant reads (`resolveCloudServiceId`) shipped in 49416c0 on
    2026-09-16 and have been on `main` — and therefore on Pages — since.
  - Distribution is a static SPA on GitHub Pages with **no service worker**, so
    a client picks up a new bundle on its next load. A pre-F6a client is only
    one whose tab has been open since before that deploy.
  - No one was using collaboration in production, so no mixed room could exist.

  Note that F6a and F6b landed in the *same* commit, so the "readers first, then
  writers" window never existed as a separate deploy — the build gate is what
  held the writer half back. That is why the gate could be settled by reasoning
  about a single deploy date rather than about two.

  **What survives the gate, and why.** `cloudServiceIdWrite()` /
  `cloudServiceIdClearingPatch()` in
  `src/features/diagram/model/cloud-service-id.ts` remain the only producers of
  the field, and `cloud-service-id.write-gate.test.ts` still fails the suite if
  another source file emits it. That concentration was built for the gate, but
  it earns its keep without one: the audit that prompted this found thirteen
  scattered write sites, and the next change to how cloud service ids persist
  has one call site to reason about instead of thirteen.

  A runtime flag that fell back to *writing* the legacy fields was considered
  and rejected at the time: `migrateUnifyCloudServiceId` deletes those fields on
  every rehydrate, the three cloud component types no longer declare them, and
  `k8s` / `oss` never had one — so the fallback would have been undone on the
  next page load while looking like protection. The cutover was schema v13 as a
  whole, which is why the gate sat at the build rather than at the write sites.

## Related

- System shape today: [architecture/element-registry.md](../architecture/element-registry.md)
- Extension inventory: [architecture/extension-points.md](../architecture/extension-points.md)
- F9 user-visible unknown-type behaviour: [guides/unknown-element-types.md](../guides/unknown-element-types.md)
