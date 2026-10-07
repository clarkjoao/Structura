# Tasks

## 1. Text patches

- [x] 1.1 `yaml-text.ts`: locate manifests and edges by node range; replace a scalar keeping its style, set a map value, cut a sequence item or document, append an edge or document; verify unit tests that untouched text is byte-identical
- [x] 1.2 Workspace patches: rename (with every edge end), description, remove element with its edges, add/remove/retype edge, restore tombstones; verify unit tests on the opscr sample, and that `compileSources` still accepts the result

## 2. Reconcile

- [x] 2.1 `reconcile.ts`: diff canvas vs binding → patched files, next binding, canvas reverts; tombstones for sync removals; verify unit tests per scenario (rename re-keys children and connections, refused rename reverts, delete, undo of delete and of a sync, new and removed connections, idempotent second run)
- [x] 2.2 Pane: run reconcile before every sync in the serial queue, on diagram change and on load; count elements not in the YAML; verify typecheck and plugin tests

## 3. End to end

- [x] 3.1 Extend `e2e/pane.mjs`: rename and delete on the canvas reach the text, undo restores it, undo of a sync removes its manifest; verify the script passes with screenshots
