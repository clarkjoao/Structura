# Design

## Decisions

**One file per folder, `opscr.layout.json`.** A folder is the workspace both the pane and the
preview read, so one sidecar per folder needs no naming rule. Keys are view node ids
(`Kind/name`), the identity the rest of the integration uses.

**Boxes are parent-relative,** exactly what `ViewLayoutResult` and the canvas snapshot hold, so
the sidecar is a `previous` layout for `stabilizeLayout` without conversion. Roots keep the
canvas's absolute coordinates.

**The canvas wins in the pane.** The previous layout for a sync is the sidecar overlaid by the
canvas boxes. The sidecar is regenerated from the canvas (bound elements only), and only replaced
in the buffer when its text changes, so a sync that moves nothing leaves it clean.

**Hidden buffer.** The sidecar is loaded like the manifests and saved by the same _Save_, but
not shown as an editor tab: it is machine-written.

**Preview.** `PreviewPipeline.update` receives the sidecar text; when it differs from the last
seen text it is overlaid on the preview's own previous layout. _Relayout_ drops the previous
layout but remembers the sidecar text, so it is not re-applied until the file changes.
