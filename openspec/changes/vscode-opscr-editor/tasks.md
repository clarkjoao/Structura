# Tasks

## 1. Editable embed

- [x] 1.1 `embed-editor.html` + `src/embed/editor`: canvas on an in-memory diagram, bridge protocol (apply changes → result, snapshot on change, theme); verify unit tests of the protocol and a browser check driving it from a parent page

## 2. Shared engine

- [x] 2.1 Move the pure modules to the plugin's `src/engine/` (they need `yaml` and stay out of the host); the extension copies them in 3.1; verify plugin tests and e2e unchanged
- [x] 2.2 `OpscrEngine` with ports; the pane uses it; verify plugin tests and e2e

## 3. VSCode editor

- [x] 3.1 Editor panel, engine over documents + webview bridge, binding in memory (each editor starts from a fresh canvas); verify unit tests of the document port
- [x] 3.2 End to end in VSCode: open, type a manifest, rename on the diagram, undo; verify the e2e suite
