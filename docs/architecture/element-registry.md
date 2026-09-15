# Element registry

How canvas elements are owned in Structura today. Long-term decisions live in
[ADR-0010](../adr/0010-element-registry.md).

## Layout

| Path | Role |
| --- | --- |
| `src/features/elements/element.types.ts` | `ElementDescriptor` contract |
| `src/features/elements/element.registry.ts` | Map registry + lookups |
| `src/features/elements/bootstrap.ts` | Registers built-ins at app load |
| `src/features/elements/families/` | C4 factory + `CloudFamilyDefinition` families |
| `src/features/canvas/nodes/node-types/registry.ts` | Legacy **plugin** render registry only |

Boot side-effect (from `main.tsx`): `import "./features/elements/bootstrap"`.

## What is registered

- **Structural:** note, db-table, json-viewer, api-group, endpoint, panel,
  process-node, external-element, svg, unknown
- **C4:** person, system, container, component (declared family, not a catch-all)
- **Cloud families** via `registerCloudFamily`: `aws`, `gcp`, `azure`, `k8s`, `oss`

Category ids (e.g. `aws-compute`) are element types; concrete services attach
through `cloudServiceId` on the component.

## Descriptor fields have readers

Every field on `ElementDescriptor` / `CloudFamilyDefinition` must have a
consumer. A declared-but-unread field is not neutral: `model.patchableKeys`
sat unread while `element-presets` kept its own hand-written copy of the same
list, the two drifted, and saving a preset of an `svg` or `process-node` threw
away the field the element cannot render without.

Current readers for the non-obvious ones:

| Field | Reader |
| --- | --- |
| `model.patchableKeys` | `element-presets/utils/element-preset.utils.ts` — what a preset may carry |
| `model.defaultZIndex` | `components.slice.ts` — stacking order at creation |
| `model.requiredFields` | LLM catalog + `search_elements` |
| `palette.spotlight` / `searchKeys` | `element.palette.ts`, both pickers |
| `CloudFamilyService.descriptionKey` | `searchElements` — per-service line, falling back to the category's |
| `canvas.derivesSize` / `canvas.canBeConnectionSource` | `single-owner.invariant.test.ts` only — they gate invariants, not behaviour |

## Ownership rules

For every registered id:

1. No legacy `NODE_TYPE_REGISTRY` descriptor matches it.
2. `buildComponentForType` equals `descriptor.model.createComponent`.
3. The type is accepted by `sanitizeComponentType` and offered to the LLM.
4. Export / handles / default size are declared on the descriptor.

Locked by `src/features/elements/single-owner.invariant.test.ts`.

## Cloud schema

| Concern | Rule |
| --- | --- |
| Write | `cloudServiceIdWrite()` / `cloudServiceIdClearingPatch()` only — the single producer of `cloudServiceId` (persist schema **v13**) |
| Read | `resolveCloudServiceId` — tolerant of legacy `awsService` / `gcpService` / `azureService` / catalog `serviceId` |
| Business catalog link | Still `BaseComponent.serviceId` — **do not** overload it for cloud |

### Deploy gate (F6b)

Code that **writes** `cloudServiceId` must not go to production until F6a
tolerant reads have been live long enough for clients to upgrade. Collaboration
checksums diverge between a client that still writes legacy cloud fields and one
that writes `cloudServiceId`. That is expected of the cutover, not a bug to
“fix” by merging early.

Two mechanisms hold it, so the rule survives someone who has not read this page:

| Where | What it does |
| --- | --- |
| `cloud-service-id.write-gate.test.ts` | Fails if any file outside the control point emits `cloudServiceId`, so the write sites stay countable |
| `cloudServiceIdReleaseGate` (`vite.config.ts`) | Aborts `npm run build` unless `VITE_ENABLE_CLOUD_SERVICE_ID_WRITE=true`; dev and tests unaffected |

Turning the flag on is the release decision itself — see
[ADR-0010](../adr/0010-element-registry.md) for why the gate is at the build
rather than a runtime fallback to legacy writes.

## LLM / IR

- Palette and tools: hierarchical `list_element_families` + `search_elements`.
- Same-turn patches: catalog reads run before `ADD_NODE`, so a model that emits
  `search_elements` and `add_node` in one response acts on the results in that
  same turn (F8b).
- **Validity is the registry, not the search.** `validateAddNodeAgainstRegistry`
  is the only thing that rejects an `ADD_NODE`: the `(elementType, serviceId)`
  pair must exist. F8b additionally required cloud writes to appear in that
  patch's own search results; that dropped valid nodes — `search_elements("redis")`
  plus `add_node("aws-compute", "lambda")` lost the Lambda — so it was retired.
  See the rationale block in `llm/add-node-validation.ts`.
- Diagram IR AWS category vocabulary: `getIrSemanticTypes()` /
  `irAwsCategoryIdsFromCatalog()`, reading the static `AWS_CATEGORIES` —
  **never** `allElements()`. Deriving it from the registry was tried (F5c) and
  reverted after it shipped broken; see
  [ADR-0010](../adr/0010-element-registry.md). Catalog↔registry parity is locked
  by `ir.types.test.ts`; the chunk boundary itself is only reachable end to end,
  by `cypress/e2e/ir-generation-smoke.cy.ts`.

## Adding a family or type

1. Prefer `CloudFamilyDefinition` + `registerCloudFamily` for catalog packs.
2. Prefer a dedicated `ElementDescriptor` for a new structural shape.
3. Register from `bootstrap.ts` (or the family’s module imported there).
4. Do **not** add built-ins to `NODE_TYPE_REGISTRY`.
5. Vendor icons with an explicit license note beside the assets.
6. Extend i18n (`en` + `pt-BR`) and accent tokens as needed.

Plugins still use `registerDescriptor` on the canvas node-type registry.
