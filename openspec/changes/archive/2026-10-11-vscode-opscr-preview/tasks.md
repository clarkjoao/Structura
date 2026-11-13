# Tasks

## 1. Stable layout

- [x] 1.1 Add `stabilizeLayout` to `src/lib/opscr-mapping`; verify unit tests: survivors keep boxes, a description-only change moves nothing, new nodes overlap no sibling, panels grow to contain children, no previous → fresh returned
- [x] 1.2 Add `src/lib/opscr-layout` (ELK runner with optional seed, import guard); verify host tests lay out the sample, and that sample + one Cache through `stabilizeLayout` keeps every sample element in place
- [x] 1.3 Switch `plugins/structura-plugin-opscr` to the synced runner and remove its copy; verify its tests, typecheck and `sync-shared --check`

## 2. Embed entry

- [x] 2.1 Extract `toGeneratedGraph` from `runPluginImport`; verify the existing plugin import tests pass unchanged and new unit tests cover the function
- [x] 2.2 Add `embed.html`, `src/embed/` and `vite.embed.config.ts` + `npm run build:embed`; verify a unit test of the message handling and a headless-browser smoke (load from a sub-path, post the sample, update, theme) with no console errors
- [x] 2.3 Remove `spike/vscode-viewer/`; verify `npm run typecheck`, `lint`, `format:check`, `test` (apart from failures already on main)

## 3. VSCode extension

- [x] 3.1 Scaffold `extensions/vscode-opscr` (manifest, esbuild bundle, sync scripts, copy of `dist-embed` without Monaco); verify `npm run build` and `npm run package` produce a `.vsix`
- [x] 3.2 Implement workspace collection, diagnostics, the update pipeline and the webview (commands _Open Preview to the Side_ and _Re-layout Preview_, theme); verify unit tests of the pure pipeline (folder collection with unsaved text, parse-failure keeps last picture, stability across an edit)
- [x] 3.3 Verify end to end in VSCode with the sample folder (manual or `@vscode/test-electron`): preview opens, follows an edit without saving, keeps positions, shows a Problems entry, follows the theme
- [x] 3.4 Document install and use in `extensions/vscode-opscr/README.md` and link it from the root README's docs; verify the documented commands run as written
