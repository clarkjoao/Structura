# Proposal

## Why

Item 1 of the opscr integration is bidirectional: YAML → diagram works (`opscr-text-editing`), but
on a bound diagram every canvas edit of something the YAML declares is silently overwritten by the
next sync, and a canvas undo of a sync leaves canvas and YAML disagreeing. The grill decided that
canvas → YAML is a targeted patch of the existing text — comments, order and formatting of
everything else untouched — never a re-serialization, and that the name is the identity, so a
canvas rename renames every reference (`.grill/opscr-yaml-diagram-integration.md`).

## What Changes

- **opscr plugin, canvas → YAML:** while a bound folder is open, canvas edits of bound elements and
  edges are written into the pane's buffers as text patches (unsaved until the user saves):
  - rename an element → `metadata.name` and every Relationship edge end that names it;
  - edit an element's description → `spec.description`;
  - delete elements → their manifests and the edges that name them;
  - draw a connection between two bound elements → a new edge (`type` = the label when it is an
    opscr edge type, else `calls`) in the Relationship that already holds the source's edges, or a
    new Relationship;
  - delete a connection → its edge; relabel it with an opscr edge type → the edge's `type`.
- **Undo across both sides:** a canvas undo or redo reaches the YAML the same way. Elements and
  edges the plugin removes (by canvas or by text) leave a tombstone with their source text, so one
  coming back restores its manifest or edge.
- Canvas edits the YAML cannot express (positions, catalog service, technology, elements drawn
  from the palette) are left alone; the pane counts elements that are not in the YAML.

## Non-Goals

- Adding elements from the palette (needs a Kind picker), reparenting by drag (`belongsTo`), and
  catalog/technology → `spec.provider`.
- The layout sidecar file, folder watching, F2 in the editor, the chat context.
- Any host API change: the plugin already reads snapshots, listens to diagram changes and applies
  batched changes (API 1.4).

## Capabilities

### Modified Capabilities

- `opscr-text-editing`: canvas edits of a bound diagram patch the YAML.

## Impact

- `plugins/structura-plugin-opscr` only: a text-patch module over `yaml` CST ranges, a
  reconciliation step run before every sync, tombstones in the binding state, pane wiring, e2e.
