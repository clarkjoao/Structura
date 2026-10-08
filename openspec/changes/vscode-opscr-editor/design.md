# Design

**Validate, then draw.** Files in VSCode change whole — a save, Claude Code writing a file, a `git
pull` — so a half-valid picture would mislead. `PreviewPipeline.update` returns no graph while the
YAML does not parse or opscr reports errors, with the reason; the preview keeps the last graph and
shows a status bar item linking to the Problems panel. Warnings never block.

**Disk is a source.** Files not open in an editor change on disk only; a file system watcher on the
folder schedules an update for any manifest, config or layout sidecar.

**What was tried first.** An editable diagram in VSCode (the editable embed bound to the documents by
the binding engine, diagram edits as `WorkspaceEdit`s) worked end to end, but was dropped: in VSCode
the YAML is the thing edited. The embed and the engine stay — the engine already runs the platform's
document pane, and its `requireValid` option serves any host where files change whole.
