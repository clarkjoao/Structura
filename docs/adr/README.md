# Architecture Decision Records

ADRs record **long-term decisions** and the trade-offs behind them, so future
contributors change them knowingly rather than accidentally.

## When to write one

Write an ADR when a decision (a) is expensive to reverse, (b) constrains many
future changes, or (c) keeps being re-asked. Do **not** write ADRs for
implementation details, reversible choices, or anything a spec already
decides — a spec's "Architecture" section may *produce* an ADR if it makes a
platform-level commitment.

## Format

One file: `NNNN-short-slug.md` with sections **Status** (Proposed / Accepted
/ Superseded by NNNN), **Context**, **Decision**, **Consequences** (including
the negative ones — an ADR without downsides is advertising, not a record).
Amendments append; history is never rewritten. Status changes go through PR
review like code.

## Index

| ADR | Title | Status |
| --- | --- | --- |
| [0001](0001-react-flow.md) | React Flow as canvas renderer, behind a canvas abstraction | Accepted |
| [0002](0002-zustand-store.md) | Zustand + Immer slice store | Accepted |
| [0003](0003-canvas-domain-separation.md) | The canvas is domain-agnostic | Accepted |
| [0004](0004-diagram-model.md) | Diagrams as source of truth today; model-as-index as the evolution path | Accepted |
| [0005](0005-extension-philosophy.md) | Registries + descriptors as the extension mechanism | Accepted |
| [0006](0006-interchange-strategy.md) | Import/export as pure boundary converters | Accepted |
| [0007](0007-local-first-persistence.md) | Local-first persistence behind a storage port | Accepted |
| [0009](0009-export-core-sharing.md) | Shared draw.io export core with a neutral IR | Accepted |
