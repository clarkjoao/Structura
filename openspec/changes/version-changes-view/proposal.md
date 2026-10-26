# Proposal

## Why

A Version shows its end state: what it removed simply is not there, what it changed looks like the
base, and only added and changed nodes carry a small badge. Reviewing an opscr initiative — "what
does this change?" — means comparing it with the root by memory. Compare mode exists, but only
between two Versions, and it freezes the canvas.

## What Changes

- **Changes view** for the active Version against the base, on by default, switched from the
  Version chip and the Version panel (remembered per user):
  - added elements and connections: green outline;
  - changed elements: amber outline, only when their content differs from the base (a moved box
    is not a change);
  - removed elements: drawn as **ghosts** where the base has them — faded, dashed red outline,
    name struck through, inert (no select, drag, connect); removed connections as dashed red
    ghost edges;
  - a one-line legend while it is on.
- Element panel: a changed element lists **what changed** (field: base → Version) — name,
  description, technology, provider/service, tags, parent; a changed connection likewise (label,
  type).
- The Version stays editable with the view on. Ghosts are drawn by the canvas only: they are not
  in the store, the snapshots plugins read, auto-layout, selection, collaboration or exports.
- Compare mode (Version vs Version) is unchanged and takes precedence while active.

## Capabilities

### New Capabilities

- `version-changes-view`: the changes view, ghosts, the "what changed" list.

## Impact

- `src/features/diagram/utils/version.utils.ts` (a `versionChanges` diff: added / changed with
  fields / removed), canvas node and edge projection (ghost nodes and edges, outline classes),
  Version chip and panel (switch), element panel (what changed), i18n `en` / `pt-BR`.
- No store, persistence, collaboration or plugin API change.
