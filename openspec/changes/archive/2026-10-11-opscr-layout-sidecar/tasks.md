# Tasks

- [x] 1.1 `opscr-mapping/layout-file.ts`: parse (tolerant), serialize (stable, one element per line), overlay; verify unit tests and sync into plugin and extension
- [x] 1.2 Plugin pane: load/save the sidecar as a hidden buffer, seed syncs with it, rewrite it from the canvas; verify unit tests (fresh diagram restored from sidecar) and the e2e (drag → saved sidecar)
- [x] 1.3 VSCode: pipeline seeds from the sidecar, watcher re-applies it, relayout ignores it until it changes; verify pipeline unit tests
