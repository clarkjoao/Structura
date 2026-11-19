# Tasks

## 1. Sidecar

- [x] 1.1 The engine remembers the boxes its last sync left; the sidecar takes only boxes moved since (panels: resized too) and the panels holding them; first sync counts what is already bound as drawn; verify unit tests (drawing writes nothing, rename, views)

## 2. Placement

- [x] 2.1 `stabilizeLayout`: mostly-kept siblings place a new element beside its connected sibling along the flow, with its siblings' card room, at the nearest free spot; mostly-new keeps the engine's arrangement; sync to plugin and VS Code; verify unit tests

## 3. Verify

- [x] 3.1 e2e `initiatives.mjs` (no writes on draw, one copy, no overlaps), `views.mjs`, `pane.mjs`; typecheck, lint, tests
