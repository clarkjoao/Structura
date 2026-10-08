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

**Undo.** Each document the engine edits gets its own `applyEdit`, so VSCode's undo in an editor
reverts that file only (one multi-file edit would make VSCode ask, in a modal, whether to undo
across files). The diagram's own undo reverts every file at once: reconcile writes the inverse.

**Binding in memory.** The webview's diagram is new on every open, so stored canvas ids would be
meaningless — worse, reconcile would read them as deletions. Each editor starts with an empty
binding; positions come from the layout sidecar.

**Fresh snapshot with every answer.** The embed's debounced snapshots lag the engine's own changes;
APPLIED answers carry the diagram as it is right after the change, so the engine never reconciles
against a picture older than its own change (which would look like the user deleted what it just
added).
