# Proposal

## Why

Moving an element into another panel (or out to the top level) on a bound diagram changes what it
belongs to, but the YAML keeps the old `belongsTo` and the next sync would put it back.

## What Changes

- **opscr plugin:** reconcile notices a bound element whose canvas parent differs from the parent
  the binding drew it in. Its first `belongsTo` (the one that nests it) is retargeted in place to the
  new panel, added when it has none, or cut when the element left every panel. The element keeps its
  id and position. A move into a panel that is not in the YAML waits until that panel is added.

## Capabilities

### Modified Capabilities

- `opscr-text-editing`: reparenting on the canvas reaches the YAML.

## Impact

- Plugin only: `setParent` patch, a reconcile step, tests and e2e (Ungroup).
