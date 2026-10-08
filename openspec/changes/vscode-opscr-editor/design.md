# Design

**Order.** Editable embed first (the main risk: the canvas outside the app shell), then the engine
extraction (a refactor with the plugin's tests and e2e as the safety net), then the VSCode editor.

**The embed is a remote plugin API.** Inside the frame, a scoped plugin facade (the same
`createScopedPluginApi` plugins get) answers `applyChanges` and `getDiagram`; diagram changes reach
the host through the same debounced notifier as `onDiagramChange`. The host never sees store objects,
only the plugin snapshot and change shapes — so the engine runs unchanged against the pane's API or
the webview bridge.

**Engine ports are async where the webview is.** `applyChanges` returns a promise; the pane wraps the
synchronous plugin call. Snapshots are pushed by the embed and cached by the bridge, so `getDiagram`
stays synchronous.

**Files in VSCode.** Reads come from open documents first (unsaved text), else disk; writes are
`WorkspaceEdit`s replacing the whole document text — VSCode diffs them into minimal edits for undo
and leaves saving to the user. Outside changes are VSCode's own document events, so no polling.
