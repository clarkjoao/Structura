# Proposal: Plugin diagram read/write API (StructuraPlugin v1.1)

## Why

The v1 API shipped by `add-canvas-plugin-mvp` fires `onDiagramChange(diagramId)` but gives a
plugin no way to read the diagram it was notified about, and no sanctioned mutation path
outside a UI panel's `PluginPanelContext`. That makes two canonical plugin archetypes
inexpressible — a diagram-change logger (draw.io devtools style) and a layout manipulator
(draw.io's "reorder children" plugin). Both only need small, additive API surface.

## What Changes

- `StructuraPluginApi` gains four additive members (API version bumps `1.0.0` → `1.1.0`,
  minor — `^1.0` manifests keep working):
  - `getActiveDiagramId(): string | null`
  - `getDiagram(diagramId?): DiagramSnapshot | null` — read-only snapshot (defaults to active)
  - `updateComponent(id, patch)` — whitelisted component fields on the active diagram,
    through the existing store action (undoable)
  - `moveComponents(moves)` — batch position changes through `applyAutoLayout`
    (one history step for the whole batch)
- `PluginComponentSnapshot` gains `parentId` (additive) so plugins can walk parent/child
  structure (needed for reorder-children use cases).
- Two new declarable capabilities: `diagram:read` and `diagram:write`.
- New example plugin `examples/plugins/console-log-plugin.js`: logs a structured diff of
  every committed diagram change to the console and offers an element-inspector panel that
  manipulates the current diagram (arrange the selected panel's children in a grid).

## Capabilities

### New Capabilities

_None — this extends the existing `plugin-system` capability._

### Modified Capabilities

- `plugin-system`: two ADDED requirements — diagram read access returns read-only snapshots,
  and top-level diagram mutation is whitelisted + undoable. Existing requirements unchanged.

## Impact

- **Modified code**: `src/features/plugins/plugin.types.ts` (API interface, capability list,
  snapshot field), `plugin-api.ts` (facade implementation), version constant `1.0.0` → `1.1.0`,
  i18n capability labels (en, pt-BR), `snapshots.ts` (`parentId`).
- **New code**: `examples/plugins/console-log-plugin.js`, tests.
- **Non-breaking**: purely additive; existing plugins and manifests unaffected.

## Non-Goals

- Mutations beyond the whitelisted component patch + positions (no add/remove component API,
  no connection mutation) — wait for real demand.
- Mutating diagrams other than the active one (the underlying store actions are
  active-diagram scoped today).
- Command/menu contribution points (draw.io plugins add menu items; Structura's equivalent
  surface is the existing panel slots).
- Event payloads richer than `diagramId` (plugins diff snapshots themselves via `getDiagram`).
