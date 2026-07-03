# ADR-0003 — The canvas is domain-agnostic

**Status:** Accepted

## Context

Diagramming tools rot in a predictable way: rendering code accumulates
business conditionals ("if this is an AWS node…", "containers can't nest
in people…") until the canvas *is* the product and nothing can change safely.
Structura's vision — many diagram types contributed over time — makes this
failure mode fatal: every contributed type would mean editing canvas
internals.

## Decision

`features/canvas` renders nodes/edges and handles interaction; it must not
know what any component **means**. All per-type policy (rendering, stacking,
parenting capability, data/style building) enters through
`NodeTypeDescriptor` contributions; all semantic rules (what may connect to
what, what may contain what) belong to the model/validation layer, which does
not exist in the canvas. Symmetrically, the model layer
(`features/diagram`) contains no React and no rendering concepts beyond
abstract layout (`nodeLayouts`).

The test: a new node type must be addable without editing any file in
`features/canvas` outside `nodes/` — and eventually without editing core at
all.

## Consequences

- (+) The canvas is a stable engine; diagram vocabularies become data.
- (+) The same separation enables headless uses (validation, AI, exports).
- (−) Descriptor indirection costs some directness: debugging "why does this
  node render this way" goes through `buildData`/`buildStyle` rather than
  inline JSX. Accepted — it is the price of the registry.
- (−) Residual violations exist (swimlane special-case in
  `resolveNodeDescriptor`, panel-awareness in drag hooks). They are tracked
  debt; new code must not add more.
- Review rule: `if (component.type === …)` in canvas code outside a
  descriptor is a defect unless justified in the PR.
