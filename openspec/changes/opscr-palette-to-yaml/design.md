# Design

**Explicit, not automatic.** Users draw notes and sketches on bound diagrams too; writing every
palette element into the YAML would pollute it. The pane offers each one with a suggestion instead.

**Bind in place.** After writing the manifest the canvas id is bound to the new key with a signature
equal to what the canvas shows (so reconcile sees no canvas edit) and the identity of the drawn
element when the shapes match — the next sync writes the manifest's name, description, technology
and catalog service onto it. When they do not match, a deliberately different identity makes the
sync replace it at the same box.

**Edges.** The `belongsTo` goes next to its siblings' (`addEdge` now falls back to Relationships
holding edges of the same type into the target). Flow edges need nothing new: once both ends are
bound, reconcile turns the canvas connections into edges.
