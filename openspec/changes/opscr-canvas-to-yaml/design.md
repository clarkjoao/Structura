# Design

## Context

- The binding (`BindingState`) maps element keys (`Kind/name`) and connection keys
  (`Kind/a->Kind/b:type#n`) to canvas ids, with the last signature written for each element.
- `planSync` only looks at the YAML side: a canvas edit stays until the YAML changes that element,
  a canvas-deleted element comes back on the next sync.
- `onDiagramChange` fires after a debounce for any committed change, including the plugin's own.

## Decisions

**The binding is the last agreed state.** A step called _reconcile_ runs before every sync, in the
same serial queue, and diffs the canvas against the binding: anything that differs was changed on
the canvas (by the user, or by undo/redo) and is patched into the buffers; the binding is updated
to match, so the sync that follows has nothing to undo. Then the sync diffs YAML against the
binding as before. Because the plugin's own `applyChanges` commits the binding before its change
event is handled, its changes reconcile to nothing — no ping-pong.

**Text surgery, not re-serialization.** Patches parse each file with `yaml`'s
`parseAllDocuments` and splice the source text at node ranges: a scalar is replaced in place
(keeping its quoting style), a sequence item or document is cut along whole lines, an edge or
document is appended in the file's own indentation. Untouched bytes are never rewritten.
Alternative: `Document.toString()` — reformats flow maps, quoting and blank lines.

**Name is identity.** A canvas rename rewrites `metadata.name` and every edge end `{ kind, id }`
naming it across all files, then re-keys the binding (ids, signatures, children's identity, which
contains their parent key, and connection keys), so the element keeps its canvas id and position.
A rename to an empty name or to a name already taken by the same Kind is refused: the canvas name
is reverted.

**Tombstones make undo symmetric.** When an element or connection leaves the binding — deleted on
the canvas (reconcile) or removed from the text (sync) — the plugin keeps its id, key, signatures
and source text (the manifest document, or the edge with its Relationship). If that id comes back
on the canvas, its text is appended back and the binding re-adopts it; if the key now exists in
the YAML again, the returning id is removed from the canvas instead. Tombstones are capped (the
oldest dropped) and persisted with the binding. For text removals the source comes from the text
as of the last sync, kept in memory.

**Connections.** A new canvas connection whose ends are both bound elements becomes an edge; the
canvas connection is adopted as is (its label may differ from the edge type, which is only a
display difference). A label change patches the edge's `type` only when the new label is an opscr
edge type (`calls`, `reads`, `writes`, …); other labels are ignored.

**Where a new edge goes.** The Relationship that already holds a non-`belongsTo` edge from the
source; else any Relationship naming the source; else a new `Relationship` named
`<source>-relationships` appended to the source's file. Removing a Relationship's last edge removes
that Relationship document (opscr requires at least one edge).

## Risks

- A canvas undo of a text rename removes the new manifest and restores the old one from the last
  synced text; edge ends the user renamed in the text stay renamed (and dangle until fixed).
- Reconcile is skipped while any file does not parse; the canvas edit is picked up once it parses.
