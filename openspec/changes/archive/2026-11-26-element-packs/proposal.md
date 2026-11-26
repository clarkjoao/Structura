# Proposal

## Why

Adding a category or a few services to the element catalog today means editing a TypeScript
catalog, the closed `ComponentType` union, a guard, both locale files, CSS accent tokens and an
icon resolver — six or more files for what is data. Plugins can register a canvas node type, but
it never reaches the palette or the element catalog, so a plugin cannot actually offer the user a
new element or shape.

## What Changes

- New **element pack** format: one JSON file (`pack.json`) plus an `icons/` folder describes a
  family — its categories, services and SVG shapes — with inline `en` / `pt-BR` labels and accent
  colours. Validated with zod at registration; an invalid pack fails loudly in dev and tests.
- Built-in packs are **auto-discovered** from `src/features/elements/packs/<packId>/pack.json`
  (`import.meta.glob`). Adding a family, category, service or shape is a JSON edit plus an SVG
  file — no TypeScript, locale, CSS or union edits.
- Pack element type ids are namespaced `<packId>/<categoryId>` and `<packId>/<shapeId>`. That form
  is already a valid `ComponentType` (`${string}/${string}`), survives `sanitizeComponentType`, and
  degrades to `unknown` without data loss when the pack is gone.
- A pack registers through the existing machinery: categories/services become a
  `CloudFamilyDefinition` (card + icon, palette variants, LLM catalog, `search_elements`, draw.io
  image/passthrough export); shapes become `ElementDescriptor`s drawn by a new generic `ShapeNode`
  (SVG outline stretched to the node, label inside, exported as an image).
- Plugin API **1.17.0** (minor, additive), capability `canvas:elements`:
  - `api.registerElementPack(pack)` — same JSON shape; `pack.id` must equal the plugin id; icons
    given inline as SVG strings.
  - `api.registerShape(shape)` — one SVG shape, offered in the plugin's own palette group.
  - Both are removed on deactivate/uninstall; components keep their data and degrade to `unknown`.
- **Migration of AWS, GCP, Azure, K8s and OSS to packs.** Their categories, services, labels,
  descriptions, accents, spotlight/primary ordering and concepts move to `packs/<id>/pack.json`.
  Their type ids stay exactly as persisted (`aws-compute`, `oss-datastore`, …): a built-in pack
  may declare `typeIds: "verbatim"`, allowed only for these five legacy families and locked by a
  test against their TS id unions. What is not data — the icon source (`aws-react-icons`,
  `gcp-icons`, `azure` icons, local SVGs) and AWS's native mxgraph export — stays in a small TS
  adapter per family. The TS catalog modules become thin views over the JSON so their consumers
  (LLM IR, draw.io import, icon pickers) are unchanged. Their locale entries and CSS accent tokens
  move into the packs.
- Docs: `docs/guides/adding-a-node-type.md` and `docs/architecture/element-registry.md` gain an
  "element pack" path, which becomes the preferred way to add catalog content.

## Non-Goals

- No end-user import of packs in the app UI (the user chose developer-authored packs only).
- No change to any persisted type id: the migrated families keep `aws-compute`, `oss-datastore`, …
- No move of the hand-written K8s structure elements (workload, namespace, cluster…) or the
  deploy family: they have custom renderers, not catalog data.
- No custom React renderers from JSON. Packs give cards and SVG shapes; anything richer remains a
  hand-written `ElementDescriptor` or `registerNodeType`.
- No native draw.io stencil mapping for pack elements (image / passthrough floor only).
- No sandboxing of plugin SVG beyond the existing SVG sanitizer.

## Capabilities

### New Capabilities

- `element-packs`: the JSON pack format, its validation, auto-discovery of built-in packs, how a
  pack's categories, services and shapes reach the registry, palette, catalog, LLM and export,
  and how pack elements degrade when their pack is absent.

### Modified Capabilities

- `plugin-system`: new `registerElementPack` / `registerShape` contracts and capability
  `canvas:elements`; contribution cleanup on deactivate now covers element packs and shapes.

## Impact

- New: `src/features/elements/packs/` (schema, loader, shape node, built-in packs folder),
  `src/features/canvas/nodes/ShapeNode/`.
- Changed: `features/elements/bootstrap.ts` (load packs), `features/plugins/plugin-api.ts` and
  `plugin.types.ts` (API 1.17.0, synced into `plugins/*` by `sync-types`),
  `PluginTypedComponent` (optional `cloudServiceId`, `technology`, `customColor` so pack cards are
  typed without casts), i18n runtime bundles for pack labels.
- No persisted schema change: new fields are optional and existing ids are untouched.
- Dependencies: none new (zod 4 is already installed).
