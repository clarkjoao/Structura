# ADR-0004 — Diagrams as source of truth today; model-as-index as the evolution path

**Status:** Accepted

## Context

The platform's defining open question: do diagrams remain the source of
truth, or does Structura evolve toward an Architecture Model where diagrams
are views? Full analysis in [vision §6](../architecture/vision.md). The
forces: the product vision ("source of truth for architecture discussions",
cross-diagram references, Architecture Map, workspace-wide AI) demands stable
element identity across diagrams; the product's *pleasure* (five-minute
sketching, freeform annotation) and the no-rewrite principle demand that
diagrams stay first-class documents. The codebase already contains four
ad-hoc bridges compensating for missing identity (`linkedDiagramId`,
`ExternalElementComponent`, `registryServiceId`).

## Decision

1. **Today, diagrams remain the source of truth.** `Diagram.snapshot` is
   authoritative; nothing may assume a workspace model exists.
2. **The committed direction is a hybrid: "model as index, diagrams as
   documents."** In order: (a) a *derived* workspace Model Index unifying
   semantic elements across diagrams (read model only — powers search,
   Architecture Map, cross-diagram refs, AI context); (b) opt-in *identity
   promotion*, where a user links/promotes a diagram component to a model
   element and renames propagate; (c) only after real usage, reassess whether
   the model becomes fully authoritative.
3. **Two-tier ontology is normative:** only *semantic* elements (systems,
   containers, cloud services, api-groups, db-tables, …) ever gain model
   identity; *annotations* (notes, panels, svg, json-viewer) stay
   diagram-local permanently.
4. The Model Index design happens in `specs/0001-architecture-model` before
   any implementation.

## Consequences

- (+) Zero migration to start delivering cross-diagram value; the sketching
  UX is never taxed for users who don't need identity.
- (+) The four existing bridges get a common home instead of a fifth variant.
- (−) A derived index can be wrong (duplicate/missed matches); unification
  heuristics and user confirmation flows are real design work.
- (−) Two consistency domains complicate collaboration (see
  [collaboration.md](../concepts/collaboration.md)); the spec must resolve
  this before identity promotion ships.
- Interim rules: no new cross-diagram bridge fields on `Component` without a
  spec; new features needing cross-diagram identity build on the service
  registry or wait for the index.
