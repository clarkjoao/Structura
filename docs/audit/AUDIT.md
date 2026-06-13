# Structura — Clean Code & Extensibility Audit

> **Phase 1 — Read-only audit.** No source files were modified.
> Scope: `src/features/`, `src/infrastructure/persistence/`, `.cursor/rules/`.
> Date: 2026-06-13 · Branch: `feat/some-improves`

## How to read this

Findings are grouped by category (Boundary Violation · Extensibility Gap · Clean Code · SDD Gap · Rule Gap) and ordered by severity within the document. Each finding lists concrete file/line evidence and a proposed fix (no code is applied yet).

A summary table is at the end.

---

## 1. LLM store deep-imports diagram **history internals**

**Category:** Boundary Violation
**Severity:** Critical
**Finding:** `features/llm/store.ts` reaches directly into the diagram store's private slice and constants to drive undo history, bypassing the `@/features/diagram` barrel.
**Evidence:** `src/features/llm/store.ts:3-4`
```
import { pushHistory } from "@/features/diagram/store/slices/history.slice";
import { STRUCTURAL_MUTATION_MARKER } from "@/features/diagram/store/store.constants";
```
Used at `src/features/llm/store.ts:198-202` (`ensureHistoryBoundary`). The barrel exports neither symbol, so this is an undeclared internal coupling — exactly the anti-pattern called out in `.cursor/rules/structura-anti-patterns.mdc` ("Feature internals import").
**Proposed fix:** Expose a public, store-level way to open a history boundary from outside React (see Finding 9). Then replace the deep imports with the public API. Do **not** widen the barrel to re-export `pushHistory` directly — that would leak a slice-mutation primitive into the public surface.

---

## 2. LLM store bypasses `IStoragePort`

**Category:** Boundary Violation
**Severity:** High
**Finding:** Chat history and LLM config are read/written with raw `localStorage`, not through the persistence port.
**Evidence:** `src/features/llm/store.ts:30,43,53,68,91` (`loadThreadFromStorage`, `saveThreadToStorage`, `loadConfigFromLocalStorage`, `saveConfigToLocalStorage`).
**Proposed fix:** Route through `IStoragePort`. Note the async-mismatch constraint in Finding 10 — config is loaded synchronously at store-creation time (`loadConfigFromLocalStorage()` at `store.ts:239`), so this fix depends on either a synchronous port surface or an async hydration step.

---

## 3. Widespread direct `localStorage` access outside `IStoragePort`

**Category:** Boundary Violation
**Severity:** High
**Finding:** Many feature modules read/write `localStorage` directly instead of going through the port. The port + adapters exist (`infrastructure/persistence/`) but are only consumed by the diagram store (`diagram.store.ts:38`, `persist.config.ts`).
**Evidence:**
- `src/features/collaboration/utils/collab-preferences.ts:15,25`
- `src/features/diagram/utils/recent-diagrams.ts:12,25`
- `src/features/diagram/hooks/useLastEdgeStyle.ts:16,26`
- `src/features/diagram/store/storage-monitor.ts:7,8,10,39` (arguably legitimate — it *measures/clears* the store itself)
- `src/features/canvas/toolbar/element-usage-tracker.ts:13,14,24,28,39,41`
- `src/features/canvas/toolbar/CanvasToolbar.tsx:66,76`
- `src/features/canvas/toolbar/element-picker/storage.ts:6,17`
- `src/features/canvas/navigation/sidebarFolderStorage.ts:5,16`
- `src/features/canvas/hooks/useCanvasCompareModeEffects.ts:25,26`

(`useCanvasInteraction.ts:102,109` is a false positive — it is the i18n key `t("localStorage.savedSuccess")`, not a storage call.)
**Proposed fix:** Route through `IStoragePort`. **Blocked by design** — the port is async-only (Finding 10) while most of these are synchronous lazy initializers / getters. Recommend (a) add a synchronous browser-storage facade or sync methods to the port, then migrate; or (b) accept these as deliberately-local UI preferences and add an explicit rule carve-out (Finding 15). Do not auto-convert sync→async in Phase 3 — it changes call-site signatures and behavior and would violate "no new patterns / strict must pass after each fix."

---

## 4. `journeys` deep-imports `canvas` internals

**Category:** Boundary Violation
**Severity:** Medium
**Finding:** The journeys feature imports six canvas modules by deep path; **every one is already re-exported by `@/features/canvas`** (`src/features/canvas/index.ts:1,14-32`), so the deep paths are gratuitous.
**Evidence:** `src/features/journeys/components/editor/journeyEditorCanvas.utils.ts:11-32` (`canvas.constants`, `edges/connectionDerivations`, `edges/edgeBuilding`, `flow/flowState`, `nodes/nodeVisibility`, `nodes/node-types`) and `src/features/journeys/components/editor/JourneyEditorCanvas.tsx:42` (`nodes/node-types`).
**Proposed fix:** Repoint all of these to `@/features/canvas`. This is mechanical and does **not** touch edge architecture (only the import path changes; `buildEdge`/`filterVisibleConnections` are already public via the barrel).

---

## 5. Canvas deep-imports `useLLMStore` instead of the LLM barrel

**Category:** Boundary Violation
**Severity:** Medium
**Finding:** Two files import `useLLMStore` from `@/features/llm/store`, although the barrel re-exports it (`src/features/llm/index.ts:43-47`). Peer files already use the barrel (`useCanvasNodes.ts:26`, `useCanvasEdges.ts:8`), so this is an inconsistency, not a missing export.
**Evidence:** `src/features/canvas/Canvas.tsx:50`, `src/features/canvas/chat/useLLMChat.ts:4`.
**Proposed fix:** Change both to `from "@/features/llm"`.

---

## 6. Canvas components deep-import diagram store internals

**Category:** Boundary Violation
**Severity:** Medium
**Finding:** Canvas UI imports `useSaveStatusStore` and `storage-monitor` helpers from diagram deep paths. `useSaveStatusStore` is **not** in the diagram barrel (only the `StorageHealthLevel` type is, `index.ts:346`); the `storage-monitor` helpers **are** in the barrel (`index.ts:341-345`) yet are still imported deep.
**Evidence:** `src/features/canvas/components/SaveStatusIndicator.tsx:4`; `src/features/canvas/components/StorageWarningBanner.tsx:5,9`.
**Proposed fix:** Add `useSaveStatusStore` (and `SaveStatus` type) to the diagram barrel; repoint both components and the `storage-monitor` import to `@/features/diagram`.

---

## 7. Canvas toolbar deep-imports `template-sharing`

**Category:** Boundary Violation
**Severity:** Medium
**Finding:** `downloadTemplate` / `importTemplateFromFile` are imported from `@/features/diagram/utils/template-sharing`, which the barrel does not export.
**Evidence:** `src/features/canvas/toolbar/PatternPicker.tsx:18`, `src/features/canvas/toolbar/UserTemplateCard.tsx:5`.
**Proposed fix:** Export both from the diagram barrel; repoint the two importers.

---

## 8. `persist.config` couples to a concrete adapter

**Category:** Boundary Violation / Extensibility Gap
**Severity:** Medium
**Finding:** Persist tracking is typed against `IStoragePort` but special-cases the concrete `LocalStorageAdapter` via `instanceof`, defeating the port abstraction (a `ServerAdapter` would silently lose the `paused`/flush behavior).
**Evidence:** `src/features/diagram/store/persist.config.ts:3,360,395`.
**Proposed fix:** Promote the needed capability (`paused`, synchronous flush) to an optional, capability-checked interface on the port (e.g. `PausableStorage`) and branch on the capability, not the class. Defer until the `ServerAdapter` work begins; low risk to leave for now but it is the kind of leak the storage-port goal is meant to prevent.

---

## 9. No public API to open a history boundary imperatively

**Category:** Extensibility Gap
**Severity:** High
**Finding:** The only way to push a structural-mutation history boundary from a non-React caller is to reach into `history.slice`/`store.constants` (Finding 1). `useHistoryActions` is a React hook, unusable from the LLM Zustand store.
**Evidence:** `src/features/llm/store.ts:198-202` vs barrel surface `src/features/diagram/index.ts:264-286` (only hooks/actions exposed).
**Proposed fix:** Add a store-level action (e.g. `beginStructuralMutation()` / `pushHistoryBoundary()`) callable via `useDiagramStore.getState()`, and export it from the barrel. This removes the deep import in Finding 1 and gives every future feature a sanctioned way to integrate with undo.

---

## 10. `IStoragePort` has no synchronous surface

**Category:** Extensibility Gap
**Severity:** Medium
**Finding:** The port is async-only (`save/load/delete/getItem/setItem/removeItem` all return `Promise`), but most real call sites are synchronous lazy initializers and getters. This mismatch is *why* features bypass the port (Findings 2, 3) — it is the root cause, not the symptom.
**Evidence:** `src/infrastructure/persistence/IStoragePort.ts:2-16`; sync call sites listed in Findings 2–3.
**Proposed fix:** Decide the contract: either (a) add synchronous `getSync/setSync` (or a separate `ISyncStoragePort`) for UI-preference data, or (b) commit to async hydration and convert call sites deliberately. This decision gates Findings 2 and 3 and should be made before any storage-port migration.

---

## 11. `llm/store.ts` is a god file with mixed responsibilities

**Category:** Clean Code
**Severity:** Medium
**Finding:** A single 593-line module mixes: localStorage I/O, history-boundary control, LLM provider routing, diagram-patch application, grid-layout geometry, the Zustand store, and four exported selector helpers — violating the single-responsibility guidance in `.cursor/rules/structura-react.mdc`.
**Evidence:** `src/features/llm/store.ts` — storage `:28-92`, geometry `:138-150`, patch application `:157-196`, history `:198-202`, provider routing `:204-217`, store `:238-546`, selectors `:548-592`.
**Proposed fix:** Extract `llm-storage.ts` (history/config persistence), `apply-diagram-patch.ts` (`applyDiagramPatchAction` + `resolveRef` + grid layout), and keep `store.ts` as orchestration. Pure-function extraction; no behavior change. Lands naturally with Findings 2 and 9.

---

## 12. Several files exceed the size guidance

**Category:** Clean Code
**Severity:** Low
**Finding:** Multiple UI/hook files exceed the rule thresholds (`structura-react.mdc`: components > 150 lines, hooks > 100 lines).
**Evidence (top offenders):** `toolbar/QuickInsertPopover.tsx:720`, `flow/useFlowModeRecording.ts:698`, `collaboration/hooks/useCollab.ts:680`, `panels/ElementPanel/ComponentPanel.tsx:619`, `Canvas.tsx:588`, `nodes/useCanvasNodes.ts:524`, `hooks/useCanvasKeyboard.ts:513`.
**Proposed fix:** Note only — pre-existing, broad surface, and several are in fragile zones. Not in scope for "safe fixes"; track separately.

---

## 13. No contract specs / `__specs__` layer

**Category:** SDD Gap
**Severity:** High
**Finding:** None of the architecture invariants are expressed as executable contract tests. There is no `src/__specs__/` directory and zero `*.contract.spec.ts` files; 36 unit tests exist but none pin the cross-cutting invariants.
**Evidence:** `find src -type d -name __specs__` → empty; `find src -name '*.contract.spec.ts'` → empty.
**Proposed fix:** Add a contract-spec layer asserting the hard invariants:
- `c4Descriptor` is last in `NODE_TYPE_REGISTRY`; `registerDescriptor` keeps it last (`registry.ts:19-56`).
- `getDescriptor`/`resolveNodeDescriptor` always return a descriptor (catch-all).
- Barrel completeness: no `@/features/*/...` deep import resolves to a symbol the feature barrel omits (could be a lint rule instead).
- Component-type discrimination uses guards, not string equality on `.type`.
These can be added in Phase 3 as **new test files only** (no source changes), making them genuinely safe.

---

## 14. No rule forbidding direct `localStorage`

**Category:** Rule Gap
**Severity:** Medium
**Finding:** The most-violated boundary (Findings 2–3) has no `.cursor/rules/` protection. The anti-patterns file forbids "I/O in Zustand slices" but says nothing about UI/util-level `localStorage` versus `IStoragePort`.
**Evidence:** `.cursor/rules/structura-anti-patterns.mdc` (no storage-port rule); 11 offending modules in Finding 3.
**Proposed fix:** Add a rule: "Persisted data goes through `IStoragePort`; direct `localStorage`/`sessionStorage` is allowed only inside `infrastructure/persistence/` adapters (and an explicitly-listed set of UI-preference modules, if Finding 10 lands as option b)."

---

## 15. No general rule forbidding cross-feature internal imports

**Category:** Rule Gap
**Severity:** Medium
**Finding:** `structura-architecture.mdc` states "use its `index.ts`," and the anti-patterns file shows a single example (`edgeBuilding`), but there is no enforceable rule, and the codebase has multiple violations (Findings 1, 4–7).
**Evidence:** repeated `@/features/<feature>/<internal>` imports across `journeys`, `canvas`, `llm`.
**Proposed fix:** Add an ESLint `no-restricted-imports` (or `import/no-internal-modules`) rule pattern `@/features/*/!(index)` from outside the owning feature, and reference it from a cursor rule. This converts the whole class of findings into CI-enforced guarantees.

---

## 16. Documentation drift: registry order & domain-React invariant

**Category:** Rule Gap
**Severity:** Low
**Finding:** Two stated invariants are imprecise against the code:
1. The documented "strict" registry order `panel → swimlane → note → apiGroup → endpoint → c4` is a subset; the real registry has 11 descriptors (`registry.ts:19-32`). The load-bearing invariant — `c4Descriptor` last — **does** hold, but the doc reads as exhaustive.
2. "`features/diagram` = no React" is contradicted by the Zustand-hooks/selector design: `store/useStorageMonitor.ts:1` and `store/selectors/diagram.selectors.ts:1` import from `react`, and the barrel deliberately exports `use*` hooks.
**Evidence:** `registry.ts:19-32`; `src/features/diagram/store/useStorageMonitor.ts:1`, `src/features/diagram/store/selectors/diagram.selectors.ts:1`.
**Proposed fix:** Clarify the rules: (1) state the invariant as "`c4Descriptor` must remain last (catch-all)" rather than fixing an order; (2) carve out the store/selector hooks from the "no React" rule, or relocate the rule to "no React in `model/` and `utils/`." Documentation-only.

---

## Summary

| # | Finding | Category | Severity | Safe to auto-fix? |
|---|---|---|---|---|
| 1 | LLM store deep-imports history internals | Boundary | Critical | After 9 lands |
| 2 | LLM store bypasses IStoragePort | Boundary | High | Blocked by 10 |
| 3 | Widespread direct `localStorage` | Boundary | High | Blocked by 10 |
| 4 | journeys → canvas deep imports | Boundary | Medium | ✅ Yes |
| 5 | Canvas deep-imports `useLLMStore` | Boundary | Medium | ✅ Yes |
| 6 | Canvas components → diagram store internals | Boundary | Medium | ✅ Yes (+barrel export) |
| 7 | Toolbar deep-imports `template-sharing` | Boundary | Medium | ✅ Yes (+barrel export) |
| 8 | `persist.config` concrete-adapter coupling | Boundary/Ext | Medium | Defer (needs ServerAdapter) |
| 9 | No public imperative history-boundary API | Extensibility | High | ✅ Yes (additive) |
| 10 | `IStoragePort` has no sync surface | Extensibility | Medium | Needs decision |
| 11 | `llm/store.ts` god file | Clean Code | Medium | ✅ Yes (pure extraction) |
| 12 | Oversized files | Clean Code | Low | Note only |
| 13 | No `__specs__` / contract specs | SDD | High | ✅ Yes (tests only) |
| 14 | No `localStorage` rule | Rule Gap | Medium | ✅ Yes (rule add) |
| 15 | No cross-feature import rule | Rule Gap | Medium | ✅ Yes (lint+rule) |
| 16 | Doc drift (registry / domain-React) | Rule Gap | Low | ✅ Yes (docs only) |

**Recommended Phase-3 order (safe subset):**
1. Findings 5, 4 — pure import-path corrections to existing barrels (no barrel changes).
2. Findings 6, 7 — add the missing barrel exports, then repoint importers.
3. Finding 9 — add public history-boundary action (additive), then fix Finding 1.
4. Finding 11 — extract pure helpers out of `llm/store.ts`.
5. Finding 13 — add contract specs (new test files only).
6. Findings 14, 15, 16 — cursor-rule / ESLint / doc additions.

**Deferred pending a decision (not "safe"):** Findings 2, 3 (depend on Finding 10's async-vs-sync port decision) and Finding 8 (depends on the `ServerAdapter` capability design).

---

## Changes Applied (Phase 3)

Applied on branch `feat/some-improves`, one logical change per commit. Each
commit was gated on "no new TypeScript errors vs. baseline" (the branch has
4 pre-existing `tsc` errors, all in files untouched here — see Validation).

| Commit | Finding(s) | What changed |
|---|---|---|
| `refactor(imports): route cross-feature imports through public barrels` | 5, 4 | `Canvas.tsx` / `useLLMChat.ts` import `useLLMStore` from `@/features/llm`; journeys editor imports canvas symbols from `@/features/canvas`; added `FIT_VIEW_*` to the canvas barrel. |
| `refactor(diagram): expose save-status and template-sharing on the barrel` | 6, 7 | Added `useSaveStatusStore`/`SaveStatus` and template-sharing fns to the diagram barrel; repointed `StorageWarningBanner`, `SaveStatusIndicator`, `UserTemplateCard`, `PatternPicker`. |
| `feat(diagram): add public pushHistoryBoundary action` | 9, 1 | New `pushHistoryBoundary()` store action (slice + `AppActions` + `useHistoryActions`); `llm/store.ts` now calls it via `useDiagramStore.getState()` instead of deep-importing `pushHistory`/`STRUCTURAL_MUTATION_MARKER`. |
| `refactor(llm): split store god file into focused modules` | 11 | Extracted `llm-storage.ts` (history/config persistence) and `apply-diagram-patch.ts` (`applyDiagramPatchAction`, `resolveRef`, `computeGridPositions`). `store.ts` 593 → 459 lines. Pure move. |
| `test(specs): add contract specs for core registry/discrimination invariants` | 13 | New `src/__specs__/` layer: registry c4-catch-all-last + `registerDescriptor` + totality; guard-based discrimination + swimlane `resolveNodeDescriptor`. 10 tests, all passing. |
| `docs(rules): add storage-port and cross-feature import boundary rule` | 14, 15 | New `.cursor/rules/structura-boundaries.mdc` (IStoragePort rule + cross-feature barrel rule + known exceptions + ESLint follow-up note). |

### Behavior

All code changes are import re-routing, additive public API, and pure
extraction — **no behavior change** intended. The `pushHistoryBoundary` action
preserves the exact prior effect (`pushHistory(state, STRUCTURAL_MUTATION_MARKER)`).

### Validation

- **Lint** (`npm run lint`): **0 errors**, 19 warnings — all pre-existing
  (`react-hooks/exhaustive-deps`, `react-refresh`), none in changed/new files.
- **Tests** (`npm run test`): **261 passing** (251 prior + 10 new contract
  tests). **1 pre-existing failure** — `useCanvasDrillHandlers.test.ts`
  (`/diagram/` vs `/model/` route drift), which fails identically at the
  original HEAD `236a28d` and is unrelated to this work.
- **Types**: 4 pre-existing `tsc` errors remain (`ExternalElementComponent`
  missing from `diagram.types` but exported by the barrel; `onAddFlowNode` in
  `ElementPickerSearchResults`; a mermaid-flowchart test; `export-drawio`).
  These predate this work, touch forbidden domain types, and were left
  untouched. No new errors were introduced (verified by stash comparison).

### Not applied (and why)

- **Findings 2, 3** (route `localStorage` through `IStoragePort`): blocked by
  **Finding 10** — the port is async-only while the call sites are synchronous
  initializers. Needs the sync-vs-async port decision before migration.
  The new boundary rule documents these as tracked exceptions.
- **Finding 8** (`persist.config` `instanceof LocalStorageAdapter`): deferred to
  the `ServerAdapter` capability design.
- **Finding 12** (oversized files): noted only; out of scope for safe fixes.
- **Finding 15 ESLint enforcement**: the cursor rule was added, but the hard
  `no-restricted-imports` rule was **not** enabled — a correct rule must allow
  documented sub-barrels (e.g. `@/features/canvas/nodes/node-types`) and test
  infra, which requires completing barrel coverage first. Recommended follow-up.
- **Finding 16** (doc drift: registry order in CLAUDE.md; "no React in domain"
  vs. store hooks): left to maintainers rather than unilaterally editing
  existing rule files / project instructions, to avoid contradicting hard
  constraints. The architecture rule already states the load-bearing form
  ("`c4Descriptor` last (catch-all)"); the gap is in CLAUDE.md's prose.
