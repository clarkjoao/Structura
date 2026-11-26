# Tasks

## 1. Kit

- [x] 1.1 `src/features/plugins/ui-kit/` facade (Button, Input, Textarea, Label, Field, Checkbox, Switch, Select, Badge, Card, Tabs, Tooltip, Separator, Stack) typed against `PluginUiKit` in `plugin.types.ts`; verify with `ui-kit.test.tsx` (render, Select reports the value, Tabs switches, Field wires label to control, className passes through).
- [x] 1.2 Expose it: `api.ui` spread + `window.__STRUCTURA_UI__` in `runtime-globals.ts`; API 1.18.0; verify with a plugin-api test (same object on both doors) and the version assertion.

## 2. Plugins

- [x] 2.1 `structura-ui.d.ts` declaration copied by each plugin's `sync-types`; run `sync-types` + `typecheck` for every plugin.
- [x] 2.2 `structura-plugin-example-ui` uses the kit in its settings panel and modal (`@structura/ui` external in `vite.config.js`, `apiVersion: "^1.18"`); built; `ui-kit-bundle.e2e.test.tsx` installs an IIFE shaped as Rollup emits it and renders kit components. The floating toolbar panel (`ToolbarButton.tsx`) keeps its own markup.
- [x] 2.3 Document the kit and theme tokens in `plugins/README.md` and `docs/architecture/extension-points.md`.

## 3. Verification

- [x] 3.1 `typecheck`, `lint` (0 errors), `test` (5302), `format:check`, `fallow:check` green; the three plugins' `sync-types --check` and `typecheck` green; in the dev app (isolated origin) the installed example-ui panel renders host components in light and dark.
