# Features Domain Organization Review (2026-04-03)

## Scope
- Reviewed `src/features/*` structure and public APIs.
- Focused on domain boundaries, coupling, and long-term maintainability.
- Deep dive on flow placement currently inside `src/features/canvas/flow`.

## Current Feature Topology (observed)

### Feature granularity is inconsistent
- `canvas` is a large "vertical app" feature with many subdomains (`nodes`, `edges`, `panels`, `toolbar`, `flow`, `navigation`, `models`, `contexts`).
- `diagram` is a domain + state feature, with rich model/store/utils internals.
- `collaboration`, `icons`, and `viewer` are much flatter with thinner folder hierarchies.
- `custom-components` is moderately structured (`components`, `hooks`, `utils`) but still flatter than `canvas`.

### Responsibility split is partially clear, partially blended
- `diagram` clearly owns Flow domain types and many flow algorithms (`flow.types`, traversal, migration, repair, duplicate patch, mermaid conversion).
- `canvas/flow` owns interaction mode and UI orchestration (panels, recorder/playback controls).
- However, the name `flow` under `canvas` makes ownership look UI-local, while true flow behavior is cross-feature and domain-level.

### Documentation drift exists
- `canvas/README.md` lists architecture and mentions `RecordingModeContext.tsx`, while code uses `FlowModeContext.tsx`.
- `diagram/store/README.md` states selectors should live only in `diagram.store.ts`, but selectors are currently split into `store/selectors/*.ts` and exported.

## Boundary Assessment: Is `flows` in `/canvas` a problem?

## Short answer
Partially yes. The **current location is acceptable for flow UI**, but not ideal as the mental model for the flow domain.

## Why this is a boundary smell
- Flow domain model is already owned by `diagram` (types + mutations + utilities).
- Flow UI in `canvas` directly consumes domain logic from `diagram` (panel imports `useFlows`, `repairFlow`, `buildFlowDuplicatePatch`, etc.).
- This yields a split-brain naming model:
  - Domain/data side: `features/diagram/*flow*`
  - Interaction/UI side: `features/canvas/flow/*`

This is not a runtime bug by itself, but it increases cognitive overhead and makes future reuse (e.g., viewer/editor-lite, CLI, automation) harder to reason about.

## Recommendation
Adopt **feature-first + layered internals** and introduce a top-level **`features/flows`** feature.

- Move all flow-specific UI/state orchestration out of `canvas/flow` into `flows`.
- Keep diagram as core modeling/persistence owner for now, then optionally lift pure flow domain logic into `flows/domain` in a second phase.
- `canvas` should consume flow capabilities through `features/flows` public API, not own flow internals.

This gives clearer domain ownership while minimizing initial migration risk.

## Proposed standard feature structure

Apply a consistent internal shape to each feature (use only relevant folders):

```text
src/features/<feature>/
  index.ts                # stable public API only
  components/             # UI components
  hooks/                  # feature hooks used by UI
  state/                  # local feature state/providers (contexts, stores)
  domain/                 # entities, value objects, domain services, rules
  data/                   # adapters/gateways/persistence integration
  utils/                  # stateless helpers (only if not domain rules)
  tests/                  # feature-focused tests
  README.md               # authoritative structure + extension rules
```

Rules:
- `index.ts` re-exports only intended API surface.
- Cross-feature imports go through `@/features/<feature>` (public API) where practical.
- Domain rules should not live in canvas-only folders.
- UI feature folders should avoid containing canonical domain types when reuse is expected.

## Suggested reorganization examples

### 1) Extract canvas flow UI into dedicated `features/flows`
Current:
- `src/features/canvas/flow/FlowPanel.tsx`
- `src/features/canvas/flow/FlowRecorderPanel.tsx`
- `src/features/canvas/flow/FlowStepNavigator.tsx`
- `src/features/canvas/flow/FlowModeContext.tsx`
- `src/features/canvas/flow/useFlowState.ts`

Proposed:
- `src/features/flows/components/FlowPanel.tsx`
- `src/features/flows/components/FlowRecorderPanel.tsx`
- `src/features/flows/components/FlowStepNavigator.tsx`
- `src/features/flows/state/FlowModeContext.tsx`
- `src/features/flows/hooks/useFlowState.ts`
- `src/features/flows/index.ts` (public API)

### 2) Keep domain logic in diagram initially, then optionally migrate
Phase 1 (low risk):
- Keep `diagram/model/flow.types.ts`, `diagram/store/slices/flows.slice.ts`, and flow utils where they are.
- `flows` feature depends on diagram APIs.

Phase 2 (optional, higher leverage):
- Move flow-specific pure logic from `diagram/utils/*flow*` to `flows/domain/*`.
- Diagram store keeps persistence/actions, but delegates rules to `flows/domain`.

### 3) Normalize feature internals over time
- Add `README.md` and a minimal `components/hooks/state/domain` convention to flatter features (`collaboration`, `viewer`, `icons`) as needed.
- Do not force empty folders; apply convention pragmatically.

## Pros/Cons: Keep flows inside canvas vs move top-level

### Keep inside `/canvas`
Pros:
- No migration overhead.
- Keeps all editor interaction code physically close.
- Fewer import path changes now.

Cons:
- Signals that flows are canvas-only, despite domain relevance.
- Harder future reuse in non-canvas contexts.
- Increases canvas feature scope creep.
- Maintainers must understand split ownership across `canvas/flow` and `diagram/*flow*`.

### Move to top-level `/flows`
Pros:
- Stronger domain clarity and ownership.
- Easier reuse across canvas, viewer, collaboration, or future surfaces.
- Better scalability as flow capabilities grow (analysis, validation, simulation, test generation).
- Reduces conceptual load inside canvas.

Cons:
- Requires staged migration and import churn.
- Temporary indirection while some flow logic still lives in diagram.
- Risk of circular dependencies if public APIs are not carefully designed.

## Migration plan (minimize breakage)

### Step 0 — Define target API (no moves yet)
- Create `src/features/flows/index.ts` with re-exports that initially point to existing `canvas/flow` files.
- Update call sites to import flow UI/state from `@/features/flows`.

### Step 1 — Move files without behavior change
- Move `canvas/flow/*` into `features/flows/{components,hooks,state}`.
- Keep temporary compatibility re-exports in `canvas/flow/index.ts` (deprecated).

### Step 2 — Decouple canvas from flow internals
- Replace deep imports like `@/features/canvas/flow/FlowModeContext` with `@/features/flows` API.
- Update canvas hooks/components to depend only on flow public API.

### Step 3 — Stabilize boundaries
- Add lint rule or code review rule: no new flow domain logic under `canvas`.
- Add/update README docs for `canvas`, `diagram`, `flows` boundaries.

### Step 4 — Optional domain extraction from diagram
- Move pure flow algorithms (`flow-mermaid`, `flow-traversal`, `flow-repair`, etc.) into `flows/domain`.
- Keep diagram store as persistence boundary; call moved domain services.

### Step 5 — Remove compatibility shims
- Remove deprecated re-exports from `canvas/flow` once imports are fully migrated.

## Risks and dependencies to watch
- **Circular dependencies:** ensure `flows` domain code does not import canvas UI.
- **Selector/store coupling:** flow hooks often rely on diagram store selectors; keep this dependency one-way.
- **Translation keys:** flow UI strings currently tied to canvas usage; verify i18n namespaces remain stable.
- **Test coverage gaps:** preserve current flow behavior with regression tests before moving files.
- **Documentation drift:** update READMEs immediately after migration to avoid stale guidance.

## Final recommendation
- **Yes, elevate flows to a top-level feature (`/features/flows`)**.
- Treat current `canvas/flow` as UI integration detail that has outgrown its host boundary.
- Migrate incrementally using compatibility exports to avoid disruption.
- Keep `diagram` as source of truth for persisted flow data initially, then optionally extract pure flow domain logic in a second pass.
