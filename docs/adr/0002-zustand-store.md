# ADR-0002 — Zustand + Immer slice store

**Status:** Accepted (records an existing decision)

## Context

Global state (workspace, active diagram, history, clipboard) needs
fine-grained subscriptions — the canvas re-renders per selector, and diagram
edits happen at interaction rates. Candidates: Redux Toolkit, React Context,
Jotai/Recoil atoms, Zustand.

## Decision

One Zustand store composed from concern-scoped slices
(`features/diagram/store/slices/*`), with Immer for draft-style mutations,
selectors in `store/selectors/*`, and `zustand/persist` with an explicit
schema version + migration chain. Satellite contexts (journeys,
collaboration, custom components, icons, LLM) get their own small stores in
the same pattern rather than joining the main store.

- Over Redux: same architecture (single store, slices, selectors) with a
  fraction of the ceremony — better contributor experience.
- Over Context: Context re-renders subtrees; selector subscriptions don't.
- Over atom models: diagram state is one coherent aggregate with
  transactional history; atomizing it fights the domain.

## Consequences

- (+) Store logic is plain TypeScript, unit-testable without React
  (`test-utils.ts`).
- (+) Slices give plugins/features an obvious place to contribute state
  later.
- (−) Discipline is conventional, not enforced: nothing stops a component
  from reaching into raw state or mutating without `pushHistory`. The rules
  live in [state-management.md](../concepts/state-management.md) and code
  review enforces them.
- (−) Undo/redo is full-snapshot based (simple, always-correct) at the cost
  of memory; bounded by `MAX_HISTORY_STEPS`. Revisit with Immer patches only
  if profiling demands it.
- Rule: persisted shape changes without a `PERSIST_SCHEMA_VERSION` bump +
  migration are blocking defects.
