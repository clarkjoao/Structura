# Tasks

## 1. Scaffold

- [x] 1.1 Create `plugins/structura-plugin-opscr` (package.json, tsconfig, vite IIFE config, manifest) with `sync-types` and `sync-shared` scripts; verify both write their files and `--check` passes

## 2. Importer

- [x] 2.1 Implement the ELK runner and the view → `ImportResult` conversion with warnings; verify plugin unit tests cover the spec scenarios (sample nesting and catalog components, non-overlapping roots, invalid manifest, invalid YAML, `canImport`)
- [x] 2.2 Register the importer in the plugin entry; verify `npm run build` produces `dist/plugin.js` and `npm run typecheck` passes

## 3. Integration and docs

- [x] 3.1 Verify end to end in the host: install the built bundle through the plugin registry in a host test-like script or the running app, import the concatenated sample, and check panels and nesting
- [x] 3.2 Write the plugin README (build with `npm link opscr`, single-file import, concatenation) and list the plugin in `plugins/README.md`; verify the documented commands run as written
