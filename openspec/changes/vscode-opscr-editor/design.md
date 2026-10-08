# Design

**Validate, then draw.** Files in VSCode change whole — a save, Claude Code writing a file, a `git
pull` — so a half-valid picture would mislead. `PreviewPipeline.update` returns no graph while the
YAML does not parse or opscr reports errors, with the reason; the preview keeps the last graph and
shows a status bar item linking to the Problems panel. Warnings never block.

**Disk is a source.** Files not open in an editor change on disk only; a file system watcher on the
folder schedules an update for any manifest, config or layout sidecar.

**Saying why there is no picture.** The extension posts `STRUCTURA_BLOCKED` (reason, error count,
first problems) to the embed: with no diagram yet it replaces "waiting for diagram", over a diagram
it is a banner. A later `LOAD_GRAPH` clears it.

**Find and focus live in the viewer.** `ViewerCanvas` gains `searchable` (Ctrl/Cmd+F opens the
existing canvas search) and `focus` (ids to frame, retried until React Flow has measured them). The
embed computes what changed between two graphs (`changedComponentIds`). VSCode keeps Cmd+F when the
preview tab has focus but the frame does not, so a keybinding forwards it as `STRUCTURA_SEARCH`.
`STRUCTURA_PROBE` lets the e2e read the viewport and search state from inside the frame.

**What was tried first.** An editable diagram in VSCode (the editable embed bound to the documents by
the binding engine, diagram edits as `WorkspaceEdit`s) worked end to end, but was dropped: in VSCode
the YAML is the thing edited. The embed and the engine stay — the engine already runs the platform's
document pane, and its `requireValid` option serves any host where files change whole.
