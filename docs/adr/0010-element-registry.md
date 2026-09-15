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
- (−) **F6b deploy gate:** schema v13 / `cloudServiceId` writes must not ship
  until F6a tolerant reads have been live long enough. Mixed collab rooms
  (legacy field writers vs `cloudServiceId` writers) diverge checksums; there is
  no component-schema version gate on the wire. Merge/deploy of this stack is a
  **human** release decision, not implied by a green branch.

  The rule is enforced by code, not by this paragraph:

  1. **One writer.** `cloudServiceIdWrite()` /
     `cloudServiceIdClearingPatch()` in
     `src/features/diagram/model/cloud-service-id.ts` are the only producers of
     the field; `cloud-service-id.write-gate.test.ts` fails the suite if any
     other source file emits it.
  2. **The build refuses.** `cloudServiceIdReleaseGate` in `vite.config.ts`
     aborts `npm run build` unless `VITE_ENABLE_CLOUD_SERVICE_ID_WRITE=true` is
     set deliberately. `npm run dev` and `npm test` are unaffected.

  A runtime flag that fell back to *writing* the legacy fields was considered
  and rejected: `migrateUnifyCloudServiceId` deletes those fields on every
  rehydrate, the three cloud component types no longer declare them, and `k8s` /
  `oss` never had one — so the fallback would be undone on the next page load
  while looking like protection. The cutover is schema v13 as a whole, so the
  gate sits at the build, where the artifact is produced.

## Related

- System shape today: [architecture/element-registry.md](../architecture/element-registry.md)
- Extension inventory: [architecture/extension-points.md](../architecture/extension-points.md)
- F9 user-visible unknown-type behaviour: [guides/unknown-element-types.md](../guides/unknown-element-types.md)
