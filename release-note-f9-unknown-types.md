# Release note — Unknown types no longer render as C4

**Slice:** F9 (element registry)  
**Behaviour change:** intentional and user-visible

## What changed

Diagram components whose `type` is corrupted or unrecognised used to be
silently rewritten to `"component"` and drawn as a normal C4 card (software
system / component box).

They now keep a visible `"unknown"` element instead. The canvas shows the
opaque/unknown node rather than pretending the data was valid C4.

## Why

The old behaviour came from two leftovers of the pre-registry era:

1. `c4Descriptor.matches: () => true` — any unmatched type rendered as C4.
2. `sanitizeComponentType` falling back to `"component"` via a hand-maintained
   `BUILTIN_COMPONENT_TYPES` list (which also caused cloud types like
   `aws-compute` to be rewritten to `"component"` before the registry
   migration — see mapping §4.2).

F9 registers C4 as a declared family of four types and removes both the
catch-all and the manual list. Validation is `elementRegistry.has` (+ plugin
namespace + a narrow cloud-prefix recovery to `*-general`).

## What you might see

- Opening an old diagram that contained a bad `type` string may show an
  **Unknown** node where a C4 box used to appear.
- The underlying payload is preserved on the unknown element where possible;
  it is no longer silently retyped as C4.

## What did not change

- Valid C4 nodes (`person`, `system`, `container`, `component`) render and
  export as before.
- Cloud categories (`aws-*`, `gcp-*`, `azure-*`) and structural shapes are
  unchanged.
- Plugin-namespaced types still degrade to unknown only when the plugin is
  absent.
