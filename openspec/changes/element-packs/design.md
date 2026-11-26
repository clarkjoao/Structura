# Design

## Context

- The element registry (ADR-0010) already derives the palette, element catalog, quick insert,
  LLM catalog, `search_elements` and export from registered descriptors, and
  `registerCloudFamily` turns a `CloudFamilyDefinition` into one descriptor per category with
  services as palette variants (`cloud-family-contract.test.ts` proves a fictional family needs
  no other edit).
- What still costs edits is everything _around_ a family: typed catalog constants, the closed
  `ComponentType` union and guards, `elements.<family>.*` keys in both locales, `--<category>`
  CSS tokens plus their Tailwind `border-l-*` classes, and an icon resolver module.
- `ComponentType` already contains `${string}/${string}` (`PluginComponentType`):
  `sanitizeComponentType` keeps it, `getDescriptor` checks the element registry before the
  plugin registry, the store's `createComponent` path builds it, and an unregistered one renders
  as `unknown` with its data intact.
- Plugins reach the canvas only through `registerNodeType` → `NODE_TYPE_REGISTRY`, which no
  palette reads.

## Goals / Non-Goals

**Goals:**

- One loader that turns validated pack data into registry entries, shared by built-in packs and
  plugins.
- Zero casts and zero edits to unions, locale files or CSS when a pack is added.

**Non-Goals:**

- Reworking the existing TS families or the `NODE_TYPE_REGISTRY` path.
- Unregistering built-in packs at runtime (only plugin packs come and go).

## Decisions

1. **Namespaced ids `<packId>/<localId>`.** Reuses `PluginComponentType`, so no union edit and
   no `as ElementTypeId` cast; persistence, sanitization and degradation already work.
   _Alternative:_ `OpenCatalogCategoryId` brand with free ids — needs a cast at every
   definition and collides with the `<family>-<category>` prefix recovery in
   `sanitizeComponentType`.

2. **`PluginTypedComponent` gains optional `cloudServiceId`, `technology`, `customColor`.**
   Pack cards are plugin-typed components that carry a catalog service; written only through
   `cloudServiceIdWrite()` (the write-gate test stays green), read through
   `resolveCloudServiceId`. Optional fields → no persist migration.
   _Alternative:_ a separate `PackComponent` variant with the same template-literal type —
   two union members with overlapping `type` make guards ambiguous.

3. **zod schema in `packs/pack.schema.ts`, `parsePack(raw)` returns a typed `ElementPack` or
   throws one error listing every issue with its path.** Cross-field checks (service → category,
   icon exists, unique ids, both locales, sanitizer verdict on shape SVG) are `superRefine`s.
   zod 4 is already a dependency.

4. **Loader `registerElementPack(pack, icons)` in `packs/pack.loader.ts`:**
   - **i18n:** builds one resource bundle per locale under `elementPacks.<packId>.*` (labels,
     descriptions) plus `elementCatalog.groups.<packId>`, added with
     `i18n.addResourceBundle(locale, "translation", bundle, true, false)` _before_ the
     descriptors are registered (the registry checks keys exist).
   - **Accent:** injects one `<style data-element-pack="<packId>">` defining
     `--pack-<packId>-<categoryId>` as HSL for light and dark (`.dark`), and the matching
     `.border-l-pack-…` class that `accent-border.ts` derives — Tailwind cannot generate classes
     for data it never sees. Removed on unregister.
   - **Categories/services → `CloudFamilyDefinition`** with the generic `CardNode`, and through
     `registerCloudFamily`; `attachService` uses `cloudServiceIdWrite`. Export: `image` with the
     icon data URI, else `passthrough` (the documented floor — no export-core edit).
   - **Icons:** an `IconResolver` over a `Map<iconName, dataUri>`; built-ins get URLs from
     `import.meta.glob("./*/icons/*.svg", { query: "?url" })`, plugins pass SVG strings that are
     sanitized and turned into data URIs. Export reuses the data URI.
   - **Shapes → `ElementDescriptor`s** (family = packId, palette category = packId) drawn by the
     new `ShapeNode`.
   - Returns an `unregister()` that removes descriptors, family, style and bundle keys.

5. **`ShapeNode`** renders `<svg viewBox preserveAspectRatio="none">` with
   `vector-effect="non-scaling-stroke"` paths filling the node, the label centred over it
   (reusing the text-edit behaviour of `ProcessNode`), the flow skin (`skin` on the descriptor →
   accent presets + Appearance section), and handles from `useHandleSides()`. Export: an
   `image` cell whose data URI is the outline with the resolved accent baked in.
   _Alternative:_ extend `FlowNodeShape` — a closed union and `flowShapeGeometry` per shape,
   exactly the edits this change removes.

6. **Built-in discovery** in `packs/builtin-packs.ts`:
   `import.meta.glob("./*/pack.json", { eager: true, import: "default" })`, imported from
   `elements/bootstrap.ts` after the TS families. Eager because registration must precede
   rehydrate (same reason bootstrap is a module side effect). The first built-in pack is
   `shapes` — original, license-free outlines (cloud, callout, triangle, star, block arrow,
   cylinder) — so the feature is exercised in production without third-party icons. A fixture
   pack with a category and services lives under `packs/__fixtures__/` for tests.

7. **Plugin API 1.17.0**, capability `canvas:elements` (added to `KNOWN_PLUGIN_CAPABILITIES`):
   `registerElementPack(pack: PluginElementPack)` where `PluginElementPack` is the JSON shape
   plus `icons: Record<string, string>` (SVG markup); `registerShape(shape: PluginShape)`.
   Shapes registered without a pack go into an implicit pack `{ id: pluginId, label:
manifest.name }`. The tracker records the `unregister()` handles; deactivation calls them.
   `plugin.types.ts` stays free of `@/` imports (it is copied into plugins by `sync-types`), so
   the pack types it exposes are spelled out there and the host schema is checked against them
   with a type-level test.

8. **Legacy families migrate as packs with `typeIds: "verbatim"` + a TS adapter.**
   - The pack JSON holds all data. Type ids stay `aws-compute`, … so nothing persisted changes;
     `verbatim` is accepted only for `aws`, `gcp`, `azure`, `k8s`, `oss` (`LEGACY_VERBATIM_PACK_IDS`).
   - The TS id unions (`AwsCategoryId`, …) stay — they type the persisted data — and each gets a
     const list checked both ways against its pack by `legacy-packs.parity.test.ts`. A new category
     in a legacy family therefore needs one line in its id list; services, which are the bulk, are
     JSON only.
   - Per-family behaviour that is not data stays in `families/<id>/<id>.adapter.ts`: the icon
     resolver (npm packages for AWS/GCP/Azure, pack SVGs for K8s/OSS — those move to
     `packs/<id>/icons/`), the export mapping (AWS native `kind: "aws"`, GCP image, Azure
     passthrough), and the component guard. A pack names its adapter by `"adapter": "<id>"`;
     packs without one use the generic adapter (pack icons, image/passthrough export).
   - `aws.catalog.ts`, `gcp.catalog.ts`, … keep their exports (`AWS_CATEGORIES`,
     `AWS_SERVICE_MAP`, `isAwsType`, …) but build them from the JSON, so the LLM IR (which must
     read static data, never the registry), draw.io import and the icon pickers are untouched.
     JSON is imported statically, so it is in the same chunk as before.
   - Locale keys `elements.<family>.categories.*`, `elements.oss.services.*` and the family labels
     move into the packs; the loader writes them back at the same key paths, so every `t()` call
     keeps working. Because i18next replaces a namespace's top level when a lazy locale arrives
     (shallow merge), the loader adds pack strings only to loaded locales and re-applies them on
     i18n's `loaded` event (adding to an unloaded locale would also make i18n skip fetching it).
   - Accent tokens move from `index.css` / `tailwind.config.ts` / `TypeConfig.ts` into the packs
     as HSL triplets (exact current values) and are injected at boot with their `border-l-*`
     classes.

## Risks / Trade-offs

- [Catalog index is memoised and misses a pack registered after boot] → rebuild it on
  `subscribeElements` (the canvas already does for `nodeTypes`); covered by a plugin test.
- [`buildCardNodeData` assumes a cloud-family guard] → resolve the family by `element.family`
  through `getCloudFamily`, not by type prefix; card test with a pack type.
- [Code paths that treat every `a/b` type as "plugin" (e.g. `UnknownElementPanel` wording)
  mislabel a missing built-in pack] → check `getCloudFamily`/pack registry first; add the
  "removed pack" case to the unknown panel copy (en + pt-BR).
- [Plugin SVG is untrusted] → every SVG goes through the existing `SvgNode` sanitizer at
  registration; rejected markup throws.
- [Migration drops or reorders a catalog entry] → before deleting each TS catalog, a snapshot of
  its categories/services/icon names/concepts is generated and the parity test asserts the pack
  reproduces it exactly.
- [LLM chunk snapshots the registry at load] → packs register in bootstrap (before the chunk) and
  the LLM reads the registry at use time; plugin packs appear on the next turn.

## Migration Plan

Additive. No persisted schema bump. Rollback = revert; saved pack nodes then render as
`unknown` and come back when the pack does.
