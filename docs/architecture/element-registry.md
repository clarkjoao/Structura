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
| `src/features/elements/packs/` | Element packs: `<id>/pack.json` + `icons/`, schema, loader, `ShapeNode` shapes |
| `src/features/canvas/nodes/node-types/registry.ts` | Legacy **plugin** render registry only |

Boot side-effect (from `main.tsx`): `import "./features/elements/bootstrap"`.

## What is registered

- **Structural:** note, db-table, json-viewer, api-group, endpoint, panel,
  process-node, external-element, svg, unknown
- **C4:** person, system, container, component (declared family, not a catch-all)
- **Cloud families** — `aws`, `gcp`, `azure`, `k8s`, `oss` — are element packs
  (`packs/<id>/pack.json`) registered through `registerElementPack` → `registerCloudFamily`
- **Shapes** from the `shapes` pack (`shapes/cloud`, `shapes/callout`, …)

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
| Read | `resolveCloudServiceId` — tolerant of legacy `awsService` / `gcpService` / `azureService` only (`cloudServiceId ?? awsService ?? gcpService ?? azureService`) |
| Business catalog link | Still `BaseComponent.serviceId` — **never** a fallback for cloud resolution |

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

Turning the flag on is the release decision itself — see
[ADR-0010](../adr/0010-element-registry.md) for why the gate is at the build
rather than a runtime fallback to legacy writes.

## LLM

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
- The LLM chunk must not snapshot the registry at module scope (F5c shipped that
  broken: the registry is empty at chunk load). Readers resolve it at call time;
  `llm/registry-snapshot.guard.test.ts` locks it. The generation IR that once
  carried a static AWS vocabulary was removed with `/generate` (DC-070); see
  [ADR-0010](../adr/0010-element-registry.md).

## Element packs

A pack is a family as data: `src/features/elements/packs/<id>/pack.json`, with its SVG icons in
`packs/<id>/icons/`. `builtin-packs.ts` finds every pack on disk and `bootstrap.ts` registers
them; plugins hand the same format to `api.registerElementPack` (API 1.17).

```jsonc
{
  "id": "observability",               // folder name; lowercase, digits, dashes
  "label": { "en": "Observability", "pt-BR": "Observabilidade" },
  "primaryCategories": ["metrics"],    // optional ordering
  "categories": [
    {
      "id": "metrics",                 // registers type "observability/metrics"
      "label": { "en": "Metrics", "pt-BR": "Métricas" },
      "description": { "en": "…", "pt-BR": "…" },
      "accent": { "light": "16 80% 50%", "dark": "16 80% 60%" } // "H S% L%" or hex
    }
  ],
  "services": [
    { "id": "prometheus", "name": "Prometheus", "category": "metrics", "icon": "prometheus",
      "concepts": ["monitoring"], "description": { "en": "…", "pt-BR": "…" } }
  ],
  "shapes": [
    { "id": "funnel", "label": { "en": "Funnel", "pt-BR": "Funil" },
      "viewBox": "0 0 100 60", "paths": ["M4 4 H96 L60 40 V56 H40 V40 Z"] }
  ]
}
```

| Concern | Rule |
| --- | --- |
| Validation | `parsePack` (zod) — unknown category, duplicate id, missing locale, non-path outline all throw with the field path; `builtin-packs.test.ts` validates every pack and its icons |
| Type ids | `<packId>/<id>` (`PluginComponentType`: no union edit, sanitized and degraded to `unknown` like plugin types) |
| Legacy ids | `typeIds: "verbatim"` only for `aws`, `gcp`, `azure`, `k8s`, `oss` — their persisted ids (`aws-compute`). Their id lists (`AWS_CATEGORY_IDS`, …) type saved data; `legacy-packs.parity.test.ts` holds list ↔ pack ↔ pre-migration snapshot. A new category in a legacy family needs one line in that list |
| Strings | Written into i18n at `elements.<packId>.*`, `elementCatalog.groups.<packId>`, `elements.families.<packId>.label` (`pack.i18n.ts`, re-applied when a lazy locale loads) — not in `en.json` / `pt-BR.json` |
| Accents | Injected `<style data-element-pack>`: the token (light + `.dark`) and its `border-l-*` / `text-*` classes — not in `index.css` / Tailwind |
| Behaviour | A `PackAdapter` (`families/<id>/<id>.family.ts`) for what is not data: icon source (npm icon sets), native export (AWS mxgraph), the legacy id guard. Packs without one use pack SVGs and the image / passthrough export |
| Catalog views | `AWS_CATEGORIES`, `GCP_CATEGORIES`, … are built from the JSON (`catalog-view.ts`, a leaf) so draw.io import keeps reading static data |
| Shapes | `ShapeNode`: outline stretched (`preserveAspectRatio="none"`, `non-scaling-stroke`), name inside, one input/output on the reading direction's sides; exported as an image |

## Adding a family or type

0. Catalog content (a family, category, service or SVG shape): write or extend an element
   pack — no TypeScript.
1. Prefer `CloudFamilyDefinition` + `registerCloudFamily` only for a family whose behaviour a
   `PackAdapter` cannot express.
2. Prefer a dedicated `ElementDescriptor` for a new structural shape.
3. Register from `bootstrap.ts` (or the family’s module imported there).
4. Do **not** add built-ins to `NODE_TYPE_REGISTRY`.
5. Vendor icons with an explicit license note beside the assets.
6. Extend i18n (`en` + `pt-BR`) and accent tokens as needed.

Plugins add catalog elements and shapes with `registerElementPack` / `registerShape`
(capability `canvas:elements`); custom React renderers still go through `registerNodeType` →
`registerDescriptor` on the canvas node-type registry.
