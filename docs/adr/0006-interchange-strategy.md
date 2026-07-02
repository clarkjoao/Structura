# ADR-0006 — Import/export as pure boundary converters

**Status:** Accepted (records an existing decision)

## Context

Structura must interoperate (draw.io, Mermaid, Structurizr, native JSON) —
import is an adoption funnel, export is an exit guarantee that builds trust.
The design risk: foreign-format concepts (mxGraph geometry, Mermaid syntax)
leaking into the domain model, or the model warping to make some format
lossless.

## Decision

Interchange lives at the boundary (`lib/export-service`) as **pure
converters**: model + layout in, foreign format out — and the reverse through
mandatory **normalization and validation** (`normalize-imported-diagram`,
`validate-diagram`, degrade-to-`unknown` for unmappable input). The model
never references any foreign format. Fidelity is a **declared policy per
format**, not an accident: each converter documents which model facets
survive (see the fidelity table in
[import-export.md](../concepts/import-export.md)); native JSON is the only
lossless format and the canonical backup/sharing form.

## Consequences

- (+) Converters are pure and heavily unit-tested without DOM or canvas.
- (+) New formats are additive; the model evolves without asking draw.io's
  permission.
- (−) Lossy round-trips are permanent for external formats (semantic
  connection intents don't survive draw.io); users must be told, not
  surprised — export UI copy is part of the contract.
- (−) The format list and per-type cell builders are hardcoded today;
  the planned importer/exporter registry and per-node-type export
  contributions ([extension-points](../extension-points/README.md)) must fix
  this without weakening the purity rule.
- Review rule: imported data that hasn't passed normalization/validation may
  not enter the store.
