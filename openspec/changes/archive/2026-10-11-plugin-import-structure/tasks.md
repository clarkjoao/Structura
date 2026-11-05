# Tasks

## 1. Store

- [x] 1.1 Add `description` and the `{ linkExisting }` option to `insertGeneratedGraph` (parents and edge endpoints outside the batch resolve to existing components of the active diagram or scene); verify with unit tests in the generated-graph slice, including that the default still ignores ids outside the batch

## 2. Plugin API

- [x] 2.1 Add `parentKey`, `cloudServiceId` and `technology` to `PluginComponentInput`, bump `STRUCTURA_PLUGIN_API_VERSION` to `1.3.0`, and refresh the plugin type copies with their `sync-types` scripts; verify `npm run plugins:sync-check` and the api-version test pass
- [x] 2.2 Route `runPluginImport` through `insertGeneratedGraph` with the registry-based type policy and parent-cycle cutting; verify unit tests for every scenario in the spec and that the example-plugin end-to-end test still passes unchanged

## 3. Documentation

- [x] 3.1 Document the importer result fields in `plugins/README.md` and add a `CHANGELOG.md` entry; verify `npm run typecheck`, `npm run lint`, `npm run format:check` and `npm run test` pass (apart from failures already on main)
