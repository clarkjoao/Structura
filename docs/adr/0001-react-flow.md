# ADR-0001 — React Flow as canvas renderer, behind a canvas abstraction

**Status:** Accepted (records an existing decision)

## Context

Structura needs an interactive node-graph canvas: viewport math, node
virtualization, handles/edge routing, selection, drag. Building this from
scratch (SVG/Canvas/WebGL) is a multi-year effort orthogonal to the product's
actual value (modeling semantics). Candidates considered: React Flow
(`@xyflow/react`), custom SVG renderer, JointJS/mxGraph-style libraries,
tldraw-style freeform engines.

## Decision

Use React Flow v12 as the canvas renderer, **confined to
`src/features/canvas/`**. No other layer imports `@xyflow/react`; the domain
model knows nothing about it. Per-type rendering goes through the
`NodeTypeDescriptor` registry so React Flow's node contract surfaces in
exactly one seam. Static rendering needs (previews, exports) bypass React
Flow entirely (`lib/diagram-preview` renders plain SVG).

## Consequences

- (+) The hard canvas problems are outsourced to a maintained,
  React-native library; contributors extend nodes with ordinary React.
- (+) Renderer independence of the model is real and continuously proven by
  the SVG preview generator and text exporters.
- (−) Framework lock-in risk is contained, not eliminated: a renderer swap
  would rewrite `features/canvas`, but nothing else. Accepted.
- (−) React Flow's performance model (re-render on node array identity)
  dictates real constraints: referential stability discipline and the
  fragile-but-tested `useLocalNodes` drag optimization exist *because* of
  this choice.
- (−) We track React Flow major versions; upgrades are periodic paid work.
- Rule for reviewers: any `@xyflow/react` import outside `features/canvas`
  is a defect.
