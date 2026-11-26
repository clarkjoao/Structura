# Tasks

## 1. Pack schema and model

- [x] 1.1 Add `ElementPack` zod schema + `parsePack()` in `src/features/elements/packs/pack.schema.ts` (format, both locales, service→category, unique ids, hex accents); verify with `pack.schema.test.ts` covering valid pack, missing category, missing `pt-BR`, duplicate ids.
- [x] 1.2 Add optional `cloudServiceId`, `technology`, `customColor` to `PluginTypedComponent`; verify `npm run typecheck` and `cloud-service-id.write-gate.test.ts` stay green.

## 2. Loader: categories and services

- [x] 2.1 `pack.loader.ts`: i18n bundles (`elements.<id>.*`, `elementCatalog.groups.<id>`, `elements.families.<id>.label`), accent `<style>` (light/dark + `border-l-*`), icon resolver from data URIs/URLs, `CloudFamilyDefinition` via `registerCloudFamily`, collision checks, `unregister()`; verify with `pack.loader.test.ts` using the fixture pack under `packs/__fixtures__/observability` (catalog group, LLM `search_elements`, create component, draw.io image export, unregister restores registry, colliding id throws).
- [x] 2.2 Card renders a pack type through the registry accent (`CardNode` already read it; `getCategoryStyle` and the minimap swatch now do too) and the element catalog rebuilds on registry changes (`elementsVersion` + `useSyncExternalStore` in `useCanvasCatalogIndex`); verified by the loader and plugin tests registering after the first build.
- [x] 2.3 Not needed: a missing namespaced type is reported as a missing plugin, which is right for plugin packs (pack id = plugin id); only a built-in pack deleted from the repo would be mislabelled, a developer-only case.

## 3. Shapes

- [x] 3.1 `ShapeNode` (SVG outline stretched, `non-scaling-stroke`, centred label, one input/output on the reading direction's sides through `SkinHandles`) and shape descriptors built by the loader; `handleSides.guard.test.ts` green. The label is renamed in the inspector (no inline edit) and the shape takes `customColor` rather than the full flow skin.
- [x] 3.2 Shape outlines accept only path data (schema regex, so no markup can reach the DOM) and export as image cells with the node's colour baked in; verified by `pack.schema.test.ts` (rejected `<script>` in a path) and `pack.loader.test.ts` (image export).

## 4. Built-in packs

- [x] 4.1 `builtin-packs.ts` auto-discovers `packs/*/pack.json` + `icons/*.svg`, registered from `elements/bootstrap.ts`; `shapes` pack (cloud, callout, triangle, star, block arrow, chevron step, cross); verified by `builtin-packs.test.ts` and `single-owner.invariant.test.ts`.
- [x] 4.2 Docs: "Element packs" section in `docs/architecture/element-registry.md`, preferred path in `docs/guides/adding-a-node-type.md`, entries in `docs/architecture/extension-points.md`.

## 5. Migrate the built-in cloud families

- [x] 5.1 Adapter mechanism (`PackAdapter` bound in each `families/<id>/<id>.family.ts`, not a JSON field; `typeIds: "verbatim"` restricted to the five legacy ids); verified by `pack.schema.test.ts` (verbatim refused for a non-legacy pack).
- [x] 5.2 OSS → `packs/oss/` (JSON, icons moved, strings out of the locales, accents out of CSS); `oss.catalog.ts` derives from JSON; `oss.family.test.ts`, `legacy-packs.parity.test.ts`, locale parity green.
- [x] 5.3 K8s catalog → `packs/k8s/` (structure elements stay TS); `k8s.family.test.ts` and parity green.
- [x] 5.4 GCP → `packs/gcp/` with the `gcp-icons` adapter and image export; `gcp.family.test.ts` and parity green.
- [x] 5.5 Azure → `packs/azure/`; `azure.family.test.ts` and parity green.
- [x] 5.6 AWS → `packs/aws/` with `aws-react-icons` + native mxgraph export, spotlight/primary/preferred and concepts (vendor category names kept as `vendorName`); `aws.family.test.ts`, export/import tests, LLM IR tests and parity green.
- [x] 5.7 Accent tokens removed from `index.css`, `tailwind.config.ts` and `TypeConfig.ts`; injected stylesheet covered by `pack.loader.test.ts` and `flowExportColor.test.ts`.

## 6. Plugin API

- [x] 6.1 API 1.17.0: `canvas:elements`, `PluginElementPack` / `PluginShape`, `registerElementPack` and `registerShape` (implicit pack named after the plugin), unregistered on deactivate; verified by `element-pack-api.test.ts`. The type-level plugin↔schema test was dropped: plugin types spell concepts as `string[]` (the file is copied into plugins without host imports), so the schema validates them at runtime instead.
- [x] 6.2 Example plugin `plugins/examples/element-pack` (pack + shape) with `element-pack-plugin.e2e.test.ts`; `sync-types` + `typecheck` run for every plugin; API documented in `plugins/README.md`.

## 7. Verification

- [x] 7.1 `typecheck`, `lint` (0 errors; 7 pre-existing fast-refresh warnings), `test` (5293), `format:check`, `fallow:check` all green. In the dev app (isolated origin): the seed catalog diagram renders every AWS/GCP/Azure/K8s/OSS card with its icon and pack accent (light and dark values equal to the old CSS); the catalog lists the pack groups and "Shapes 7" ("Formas" in pt-BR); a cloud shape inserts, renders its outline, label and handles, and survives a reload. Resize, draw.io export and plugin disable were checked by the unit/e2e tests, not by hand.
