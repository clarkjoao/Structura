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
5. **Persisted cloud service id is `cloudServiceId`.** Reads stay tolerant
   (`resolveCloudServiceId`: `cloudServiceId ?? awsService ?? gcpService ??
   azureService ?? serviceId`). Writes use `cloudServiceId` only
   (`PERSIST_SCHEMA_VERSION` 13). This is **not** the business-catalog
   `BaseComponent.serviceId`.
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
- (−) IR AWS category allowlist must not snapshot `allElements()` inside the
  lazy LLM chunk — use `AWS_CATEGORIES` / `getIrSemanticTypes()` (see
  `src/features/llm/ir/ir.types.ts`).
- (−) **F6b deploy gate:** schema v13 / `cloudServiceId` writes must not ship
  until F6a tolerant reads have been live long enough. Mixed collab rooms
  (legacy field writers vs `cloudServiceId` writers) diverge checksums; there is
  no component-schema version gate on the wire. Merge/deploy of this stack is a
  **human** release decision, not implied by a green branch.

## Related

- System shape today: [architecture/element-registry.md](../architecture/element-registry.md)
- Extension inventory: [architecture/extension-points.md](../architecture/extension-points.md)
- F9 user-visible unknown-type behaviour: [guides/unknown-element-types.md](../guides/unknown-element-types.md)
