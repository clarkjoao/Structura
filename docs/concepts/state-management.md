# State Management

Global state is a single Zustand store with Immer, composed from slices
(`src/features/diagram/store/`). Satellite features (journeys, collaboration,
custom components, icons, LLM) keep their own small stores following the same
pattern.

## Why Zustand + Immer

Chosen over Redux/Context/Jotai for: no provider tree, selector-based
subscriptions (critical for canvas performance — components subscribe to
slices of state, not the world), tiny API surface for contributors, and
Immer giving mutable ergonomics with immutable semantics. Trade-offs and
alternatives are recorded in [ADR-0002](../adr/0002-zustand-store.md).

## Store composition

```
DiagramStore = AppState + AppActions
AppState: diagrams, folders, userTemplates, serviceRegistry,
          activeDiagramId, past/future (history), clipboard
AppActions: contributed by slices in store/slices/
```

Each slice owns one concern (components, connections, flows, scenes,
folders, services, icons, clipboard, history, layout, parenting,
component-links, patterns, user templates) and exposes actions; selectors
live separately in `store/selectors/`. The rule: **UI calls actions and
subscribes to selectors — nothing else.**

## History (undo/redo)

- `past`/`future` hold `DiagramSnapshot`s: **full `ModelDraft` copies** per
  diagram plus node layouts, with a timestamp.
- Every structural mutation calls `pushHistory` *before* mutating.
- Rapid consecutive edits coalesce (timestamp window) so typing a name is one
  undo step, not twelve.
- Bounded by `MAX_HISTORY_STEPS` to cap memory.

**Why snapshots, not command inversion:** snapshots are impossible to get
wrong per-action — any new mutation is automatically undoable, which matters
enormously when mutations will eventually come from plugins and AI patches.
The cost (memory) is bounded and acceptable at current diagram sizes. If
profiling ever says otherwise, the migration path is structural sharing
(Immer patches), not hand-written inverse commands.

## Persistence coupling

The store persists via `persist.config.ts` with an explicit
`PERSIST_SCHEMA_VERSION` and a migration chain. **Any change to persisted
shapes requires a migration and version bump** — this is a hard rule because
users' workspaces are the only copy of their data (no backend to repair
from). See [persistence.md](persistence.md).

## Save status & storage monitoring

`saveStatus.store.ts` tracks dirty/saving/saved for the UI indicator;
`storage-monitor.ts` + `storageQuota.ts` watch localStorage pressure and
surface warnings before writes start failing (a real failure mode for large
workspaces — one of the drivers for the FileSystem adapter).

## Rules for new state

1. New global state goes in a slice (or a satellite store if it is a separate
   context), never in a React context or component state that outlives its
   component.
2. Structural mutations call `pushHistory`.
3. Persisted additions get a migration.
4. Derived data gets a selector, not a duplicated field.
5. Transient UI state (hover, open menus) stays in components — the store is
   for state that outlives interaction or crosses features.
