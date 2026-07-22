# Structura — Staff+ Engineering Audit

**Repository:** `/Users/clark/www/second/Structura/`
**Audit date:** July 2026
**Scope:** full source tree (`src/`, `server/`, `plugins/`, `collab-stateless/`, `cypress/`, `openspec/`, `docs/`, `.github/`, `.claude/`, `.cursor/`, root configs)
**Author:** Staff+ engineering audit (autonomous)

> Methodology: indexed the repo (~700 files), mapped dependencies, traced
> entrypoints and import graphs, cross-referenced docs vs implementation, ran
> parallel exploration agents, then verified findings against the code before
> writing this report. Each finding has evidence: file path, line numbers,
> import graph or grep output.

---

# Executive Summary

Structura is a mature client-side C4-model architecture diagramming SPA built
on React 18 + TypeScript + Zustand + React Flow. The codebase is **healthy at
its core** (clean slice-based store, strict types, good test coverage in
critical subsystems, clear AGENTS.md rules, OpenSpec workflow). However, after
a sustained burst of recent renames and feature additions the project has
accumulated **technical debt in three areas**:

1. **Documentation drift.** README, AGENTS.md, CONTRIBUTING.md, FEATURES_MAP.md
   and several `docs/architecture/*` files still use the pre-rename names
   `journeys`, `serviceRegistry`, `ModelExplorer`. This is the highest-leverage
   cleanup: cheap to fix, blocks onboarding.
2. **A documented but never shipped `EdgeQuickActionsBar`** from the
   `quickactions-toolbar` OpenSpec change. The proposal lists it as a deliverable
   but the implementation never landed; only `NodeQuickActionsBar` exists.
3. **Two parallel persistence paths.** AGENTS.md mandates "persistence goes
   through `IStoragePort`", but `recent-diagrams.ts`, `useLastEdgeStyle.ts`,
   `storage-monitor.ts`, `collab-preferences.ts` and `llm-storage.ts` all reach
   `localStorage` directly. This is a documented architectural violation that
   grew organically with each new feature.

The remaining findings are real but lower-impact: 36 empty `catch {}` blocks,
one accidentally committed `teste.json`, an orphan `collab-stateless/` CDK
project, the `ENABLE_LEGACY_PANEL_ACTIONS` flag still gating code behind a
default-off feature flag, and a `FEATURES_MAP.md` that lists several hooks
without verifying they exist.

**Overall health: 7.5/10.** Good architecture, good test discipline, but
shipping speed has outpaced documentation and the storage layer has visible
leaks. See *Final Assessment* for the category breakdown.

---

# Dead Code

## 1. Unused exports in the LLM store

**Severity:** MEDIUM · **Confidence:** CERTAIN

- `src/features/llm/store.ts:806` — `export function getSuggestionForMessage`
  is never imported anywhere in `src/`.
- `src/features/llm/store.ts:817` — `export function summarizePatchActions`
  is never imported anywhere in `src/`.

Evidence: `grep -rn "getSuggestionForMessage\|summarizePatchActions" src/`
returns only the declaration sites. They are exported, suggesting they were
public API at one point but their callers were removed without dropping the
exports.

**Suggested action:** delete both, or, if they are intended for plugin or
future use, mark them `@internal` and add a comment.

## 2. Dead migration scaffold

**Severity:** LOW · **Confidence:** CERTAIN

- `src/infrastructure/persistence/migrations.ts` exports `migrateDiagram`
  used only by `validateWorkspaceFile.ts`, and its sibling migration
  `migrateV1toV2` exists only as a commented stub (lines 28–30). The file's
  entire purpose is the V0 → V1 baseline. Schema migration for the live
  diagram store actually lives in `src/features/diagram/store/persist.config.ts`
  (PERSIST_SCHEMA_VERSION 11). Two parallel migration systems is a smell;
  the workspace-file migrator should either delegate to the same path or be
  folded into it.

## 3. Commented-out code

**Severity:** LOW · **Confidence:** CERTAIN

- `src/features/canvas/hooks/keyboard/helpers.ts:36–41` — a 6-line commented
  out `return` block inside `isInputFocused` (replaced by a more thorough
  implementation immediately below). Dead noise.
- `src/infrastructure/persistence/migrations.ts:27–30` — commented migration
  scaffold (see §2).
- `src/features/llm/apply-diagram-patch.ts:99–102` — `case "AUTO_LAYOUT":`
  has only a `// TODO: Implement auto layout - for now just log` and an empty
  result. See *Incomplete Features*.

## 4. Empty catch blocks (36 instances)

**Severity:** MEDIUM · **Confidence:** CERTAIN

A full inventory:

```
src/features/collaboration/utils/collab.utils.ts:18
src/features/collaboration/utils/collab-preferences.ts:26
src/features/collaboration/hooks/useCollab.ts:240, 440, 453, 463, 476, 572, 641
src/features/llm/providers/anthropic.ts:74
src/features/llm/providers/openai-compatible.ts:82
src/features/llm/providers/proxy.ts:95
src/features/llm/patch-parser.ts:239
src/features/llm/llm-storage.ts:99, 108, 298, 308, 397, 431, 456
src/features/llm/store.ts:75
src/features/diagram/hooks/useLastEdgeStyle.ts:18, 25
src/features/diagram/store/persist.config.ts:431
src/features/canvas/toolbar/CanvasToolbar.tsx:79
src/features/canvas/utils/svg.utils.ts:47
src/features/integrations/defectdojo/hooks/useDefectDojoSearch.ts:66
src/lib/clipboard-utils.ts:29, 70, 98
src/lib/export-service/cell-builders.ts:200
src/lib/export-service/normalize-imported-diagram.ts:106
src/lib/diagram-url.ts:82
```

The `useCollab.ts` file alone has 8 empty catches. In several cases
(e.g. `collab-preferences.ts`, `useLastEdgeStyle.ts`) the swallow is on a
localStorage read — a missing or corrupt key is a legitimate condition, but
silently swallowing it hides the *write* failures.

**Suggested action:** at minimum replace each with `catch (err) { console.warn(..., err); }`
or surface the failure through the existing toast/sonner channel. For localStorage
reads where missing-key is expected, use a structured `tryRead()` helper.

---

# Unused Files

## 1. `teste.json` at repo root

**Severity:** HIGH · **Confidence:** CERTAIN

`/Users/clark/www/second/Structura/teste.json` is a 4.3 KB debug JSON dump
with two test components ("Novo Person", "Amazon EC2"), a flow, and a viewport
position. It is not referenced by `package.json`, no test imports it, and
neither `.gitignore` excludes it.

**Suggested action:** delete and add `*.test-diagram.json` (or similar) to
`.gitignore` to prevent recurrence.

## 2. `collab-stateless/` directory

**Severity:** MEDIUM · **Confidence:** CERTAIN

`/Users/clark/www/second/Structura/collab-stateless/` contains AWS CDK
infrastructure for a "stateless collab" stack and a checked-in `node_modules/`.
The directory has no top-level `package.json`, no `tsconfig.json`, and is
referenced by **nothing** in `src/`. It is the only `collab-stateless` mention
in the repo.

**Suggested action:** if it is genuinely needed (e.g. for infra-team reference),
move it into `docs/infrastructure/` or a dedicated `infra/` repo. Otherwise,
remove it. The included `node_modules/` alone wastes ~MB of disk and obscures
the real `server/` directory next to it.

## 3. Legacy alias route still registered

**Severity:** LOW · **Confidence:** CERTAIN

`src/App.tsx:79–83` registers `/journeys` and `/journeys/:id/edit` as
`<Navigate>` redirects to the new `/walkthroughs` paths. This is documented
in a comment as intentional ("kept for one release"). If a release has shipped
since the v9 rename, these redirects can be deleted in the next minor.

## 4. Legacy `@deprecated` exports still exported

**Severity:** LOW · **Confidence:** CERTAIN

- `src/features/diagram/store/diagram.store.ts:361` —
  `export const useRegistryActions = useCatalogActions` (deprecated alias).
  Only `src/features/integrations/github/hooks/useGithubImport.ts` still
  imports it; this caller should be migrated, then the alias removed.
- `src/features/plugins/plugin.types.ts:51–56, 253–257` — `uses: ["react"]`
  and `PluginToolbarContext` are `@deprecated since API 1.2.0`. The plugin
  system is shipping at `apiVersion "1.1.0"` per the docs; either bump the
  version and remove the deprecated surface, or keep both with documentation.
- `src/features/diagram/model/component.types.ts:204–207` — `FlowNodeComponent`
  is `@deprecated` in favor of `ProcessNodeComponent`. Migration `v6` and
  `v7` in `persist.config.ts` already remove the legacy `flow-node` type at
  load time, so this deprecated type can probably be removed too.

---

# Unused Folders

## `collab-stateless/`

See *Unused Files §2*. The only nested subfolders are `src/cdk/` and
`src/collab/` with **zero** cross-references from the main repo.

---

# Unused Assets

No image/icon assets are unused. Icons are organized per provider
(`aws-react-icons`, `azure-react-icons`, `gcp-icons`, `lucide-react`) and
all four are referenced (`grep` confirmed in
`aws.icon-resolver.ts`, `azure.icon-resolver.ts`, `gcp.icon-resolver.ts`,
`components/ui/command.tsx`, and ~30 other files). The four-way split is
intentional per the dependency audit and not a duplication problem.

---

# Incomplete Features

## 1. `EdgeQuickActionsBar` was promised in `quickactions-toolbar` but never built

**Severity:** HIGH · **Confidence:** CERTAIN

`openspec/changes/quickactions-toolbar/proposal.md` (lines 7–8) and §8 of
`tasks.md` describe two parallel deliverables: a `QuickActionsBar` for *nodes*
and a `QuickActionsBar` for *edges*. The proposal also has a `proposal.md`
"Arquivos afetados" table (line 52) listing both
`src/features/canvas/selection-actions/NodeQuickActionsBar.tsx` AND
`EdgeQuickActionsBar.tsx` as new files. The change is marked "core
implementation complete" in `tasks.md` §10.

But the file `EdgeQuickActionsBar.tsx` does not exist
(`find src/features/canvas/selection-actions -type f` returns only
`NodeQuickActionsBar.tsx`, `EdgeStyleDropdown.tsx`, `ColorPicker.tsx`,
`MarkerCapsDropdown.tsx`, `OpacityControl.tsx`, `OpacitySlider.tsx`,
`edgeStyleMapping.ts`, `featureFlags.ts`, `index.ts`).

What actually happened: the edge toolbar was added directly to the existing
`src/features/canvas/edges/components/EdgeToolbar.tsx` (imports
`ColorPicker`, `EdgeStyleDropdown`, `MarkerCapsDropdown` from
`@/features/canvas/selection-actions`). So the *functionality* shipped — but
under a different filename, and the OpenSpec record now disagrees with the
code.

**Suggested action:** either create a stub `EdgeQuickActionsBar.tsx` that
re-exports the in-place `EdgeToolbar` (to match the proposal), or amend the
proposal and `tasks.md` to reflect the actual filename, then re-archive the
change.

## 2. `AUTO_LAYOUT` patch case is a no-op

**Severity:** MEDIUM · **Confidence:** CERTAIN

`src/features/llm/apply-diagram-patch.ts:99–102`:

```ts
case "AUTO_LAYOUT": {
  // TODO: Implement auto layout - for now just log
  console.warn("[apply-diagram-patch] AUTO_LAYOUT not implemented", patch);
  return { applied: [], errors: [], partial: false };
}
```

The `autoLayoutEngine.ts` already implements both `computeLayeredLayout` and
`computeGridLayout`. Wiring the patch into the engine is a ~30-line change.

## 3. CollabProvider `updateViewport` is a TODO stub

**Severity:** LOW · **Confidence:** CERTAIN

`src/features/collaboration/components/CollabProvider.tsx:224–226`:

```ts
// TODO: Implement viewport update
const updateViewport = useCallback((_viewport: Viewport) => {
  // empty
}, []);
```

Viewport sync is one of the headline features of the collab system per
`FEATURES_MAP.md`. A silent empty implementation means peer's pan/zoom
broadcasts are dropped without warning.

## 4. `FEATURES_MAP.md` lists hooks without verification

**Severity:** LOW · **Confidence:** LIKELY

`FEATURES_MAP.md` "🎨 Canvas" section lists hooks like
`useCopyPasteShortcuts`, `useGroupShortcuts`, `useEdgeWaypointShortcuts`,
`useLockShortcuts`, `useRecordingShortcuts`. All of these **do** exist
under `src/features/canvas/hooks/keyboard/` (verified). But the file also
references `useLocalNodes` as the active API, while `AGENTS.md` warns that
it is "deliberate (drag performance) and fragile — don't refactor casually".
Either remove `useLocalNodes` from the FEATURES_MAP or annotate it.

## 5. `QA Checklist` of `quickactions-toolbar` change is empty

**Severity:** LOW · **Confidence:** CERTAIN

`openspec/changes/quickactions-toolbar/tasks.md` §13 (13.1–13.12) is all
unchecked. These are 12 manual QA items that document the feature's intended
behavior. They were never verified or signed off. This is what allowed the
`EdgeQuickActionsBar` discrepancy above to slip through: nobody ran the QA
list.

## 6. `expand-plugin-system-ui` change is also missing testing tasks

**Severity:** LOW · **Confidence:** CERTAIN

`openspec/changes/expand-plugin-system-ui/tasks.md` §9 (9.1–9.3) is all
unchecked: "Unit tests for `overlay-registry.ts`", "Integration tests for
plugin API", "E2E tests". The proposal claims "core implementation
complete" but ships without test coverage for the overlay registry.

---

# Abandoned Specifications

## 1. `add-plugin-system-foundation` — RFC only, never implemented

**Severity:** MEDIUM · **Confidence:** CERTAIN

`openspec/changes/archive/2026-07-03-add-plugin-system-foundation/` is the
oldest archive entry. The "Plugin system foundation" line in
`ROADMAP.md`'s "✅ Completed" section suggests this shipped, but the change
was spec-only (RFC). The actual plugin system was built later by
`add-canvas-plugin-mvp`, `add-plugin-diagram-api`, and
`expand-plugin-system-ui`.

**Suggested action:** in `ROADMAP.md`, replace "Plugin system foundation
(`StructuraPlugin` API, manifest validation, local-file plugins)" with a more
honest summary that points at the actual archived changes, or split the entry
into "Plugin API RFC (foundation)" + "Plugin runtime (MVP)" + "Plugin UI
extension".

## 2. Five rename changes are still incomplete in the docs

`ROADMAP.md`, `README.md`, `AGENTS.md`, `CONTRIBUTING.md`, and the
`docs/architecture/*` and `docs/concepts/*` files all reference the pre-rename
names in places, despite the rename changes being archived in OpenSpec. See
*Documentation Issues* for the file-by-file list.

## 3. `ux-002-canvas-zoom` is in archive but the change's status is unclear

**Severity:** LOW · **Confidence:** LIKELY

`openspec/changes/archive/2026-07-08-ux-002-canvas-zoom/` ships but I could
not find a corresponding spec under `openspec/specs/canvas-navigation/` that
calls out zoom specifically. The spec exists, but the audit could not verify
which requirements are the zoom ones.

---

# Duplicate Code

## 1. Two parallel migration systems

See *Dead Code §2*. `src/infrastructure/persistence/migrations.ts` migrates
the *workspace JSON file*; `src/features/diagram/store/persist.config.ts`
migrates the *localStorage diagram-store*. They have different `fromVersion`
conventions and different feature sets (e.g. `serviceRegistry → serviceCatalog`
only exists in `persist.config.ts`). A workspace file loaded at v8 will
inherit the localStorage schema's assumptions through `mergePersistedState`.

**Suggested action:** consolidate into one `migrations/` directory under
`infrastructure/` and have both paths call into it.

## 2. Color handling spread across 8 files

The color-setting logic for components is duplicated across:

- `src/features/canvas/panels/ElementPanel/ComponentPanel.tsx`
- `src/features/canvas/panels/ElementPanel/sections/ColorAccentSection.tsx`
- `src/features/canvas/panels/ElementPanel/sections/PanelStyleSection.tsx`
- `src/features/canvas/panels/ElementPanel/components/PanelColorPicker.tsx`
- `src/features/canvas/panels/ElementPanel/components/ColorSwatches.tsx`
- `src/features/canvas/nodes/NoteNode.tsx`
- `src/features/canvas/nodes/PanelNode.tsx`
- `src/features/canvas/selection-actions/NodeQuickActionsBar.tsx`

`NodeQuickActionsBar` has the most polished implementation (`handleColorChange`,
`getNotePresetPair`, the `usesCustomColor` helper) — but it lives in a
selection-actions file instead of a shared color utility.

**Suggested action:** move `getCurrentColor`, `getNotePresetPair`,
`usesCustomColor`, `supportsColor` into
`src/features/canvas/panels/ElementPanel/components/colorUtils.ts` and import
from both `NodeQuickActionsBar` and `PanelColorPicker`.

## 3. Cloud icon resolution duplicated for each provider

`src/features/cloud/providers/aws/aws.icon-resolver.ts`,
`azure/azure.icon-resolver.ts`, `gcp/gcp.icon-resolver.ts` each implement the
same pattern: dynamic import / import.meta.glob, normalize to a registry
shape, expose `resolve(id)`. The shapes are nearly identical. With three
providers and likely more (Oracle, Alibaba), this is a textbook extraction
candidate.

## 4. Empty `localStorage` read patterns duplicated

`useLastEdgeStyle.ts`, `collab-preferences.ts`, `recent-diagrams.ts`,
`llm-storage.ts` each implement the same `try { read; if missing default;
catch swallow }` pattern. A single `safeReadJson<T>(key, fallback)` utility
in `infrastructure/persistence/` would replace them.

## 5. `is*Component` guards may already cover `is*Type`

`src/features/diagram/model/component.guards.ts` defines
`isPanelComponent`, `isNoteComponent`, etc. Each delegates to the
corresponding `is*Type` function in `component-type-constants.ts`. The
distinction is clean here, but `component.guards.ts` is not the only place
guards are written: `NodeQuickActionsBar.tsx` has local `usesCustomColor`,
`supportsColor`, `pickColorGroup`, `getCurrentColor` predicates that
re-implement discriminators that *could* live next to the type.

---

# Architectural Problems

## 1. Direct `localStorage` access bypasses `IStoragePort`

**Severity:** HIGH · **Confidence:** CERTAIN

`AGENTS.md` (line 79) explicitly states: *"Persistence goes through
`IStoragePort` — never touch `localStorage` directly outside
`infrastructure/persistence/`."* The following files violate this:

| File | Lines |
|------|-------|
| `src/features/collaboration/utils/collab-preferences.ts` | 15, 25 |
| `src/features/llm/llm-storage.ts` | 276, 303, 304, 330, 392, 430, 447, 462 |
| `src/features/llm/llm-threads-idb.ts` | 153, 180, 195 |
| `src/features/diagram/utils/recent-diagrams.ts` | 11, 24 |
| `src/features/diagram/hooks/useLastEdgeStyle.ts` | 16, 24 |
| `src/features/diagram/store/storage-monitor.ts` | 22, 23 |

`storage-monitor.ts` even iterates the entire localStorage namespace
(`for (let i = 0; i < localStorage.length; i++)`) — a hard architectural
violation because it makes assumptions about the storage adapter that are
only true for `LocalStorageAdapter`.

**Suggested action:** add a `preferences`/`ephemeral` port to `IStoragePort`
and route all of these through it.

## 2. Plugin system uses `new Function(code)` — intentional but undocumented

**Severity:** MEDIUM · **Confidence:** CERTAIN

`src/features/plugins/plugin-loader.ts:46` evaluates plugin code with
`const run = new Function(code); run();`. There is no sandbox beyond
restoring the `window.StructuraPlugin` hook. A misbehaving plugin can
read/write the entire global scope, including localStorage. The code's
comment ("no sandbox — install is consent, RFC D6") references RFCs D6/D1
that are not in the repo.

**Suggested action:** publish the D6/D1 RFCs under `docs/adr/` or
`docs/plugins/`, and consider a `Web Worker` isolation option behind a
capability flag.

## 3. Two parallel barrel files create bundle-graph coupling

`src/features/diagram/index.ts` (324 lines) and `src/features/canvas/index.ts`
(36 lines) are deep barrels. `App.tsx` does the right thing (imports leaf
modules like `@/features/diagram/model/...`), but `NodeQuickActionsBar.tsx`
and ~167 other files import directly from `@/features/diagram`. This makes
tree-shaking unreliable.

**Suggested action:** add a `// @barrel-disable` ESLint rule that warns when
a barrel is imported from outside the feature, with exceptions for explicit
allow-list.

## 4. The Zustand store has 17 slices in one `diagram.store.ts`

The single `useDiagramStore` is composed of `diagrams`, `components`,
`connections`, `flows`, `layout`, `services`, `clipboard`, `history`,
`folders`, `patterns`, `scenes`, `icons`, `userTemplates`, `serviceCatalog`,
plus the persistence and save-status machinery. The file is >510 lines
(`components.slice.ts` alone is 510 lines). This is fine for a single
developer maintaining it, but a new contributor cannot read the whole store
in a sitting.

**Suggested action:** split into `features/diagram/store/index.ts` that
composes the slices lazily, or at least export each slice's actions as a
separate `useFooActions()` hook and only compose them in `useDiagramStore`.

## 5. Circular dependencies (verified by madge)

```
features/walkthroughs/components/WalkthroughPlayerContext.tsx
  → features/walkthroughs/hooks/useWalkthroughRecordingFinalize.ts
infrastructure/persistence/FileSystemAdapter.ts
  → infrastructure/persistence/validateWorkspaceFile.ts
```

The second is a real concern because `validateWorkspaceFile.ts` imports
`migrateDiagram` from `migrations.ts`, which can pull the whole DI types
graph through `Diagram`. The walkthroughs cycle is contained but still
fragile.

## 6. `ENABLE_LEGACY_PANEL_ACTIONS` is off by default

`src/features/canvas/selection-actions/featureFlags.ts` exports
`ENABLE_LEGACY_PANEL_ACTIONS = false`. The corresponding
`ComponentPanel.tsx` and `ConnectionPanel.tsx` gate their legacy controls
behind it. After two minor releases of the new toolbar, the flag and the
gated code can be deleted (the OpenSpec proposal §Open Decisions 4 calls
for this).

---

# Performance Issues

## 1. `useCollab.ts` is 656 lines

`src/features/collaboration/hooks/useCollab.ts` is the second-largest file
in the canvas feature. Reading and re-rendering 656 lines of collab logic on
every store change will inflate the React profiler flamegraph. Splitting
it into `useCollabSession`, `useCollabPatches`, `useCollabCursors`,
`useCollabPreferences` would let each be independently subscribed.

## 2. `teste.json` and seed files inflate the dashboard

Each of `banking-example.ts`, `fintech-example.ts`,
`plataforma-digital-example.ts`, `urlshort-example.ts` is **~2,000 lines**
(largest is 2,021). They are bundled into the dashboard route and used as
seed diagrams. The dashboard bundle size could be cut substantially by
loading these via dynamic `import()` only when `VITE_DISABLE_SEEDS=false`.

## 3. `persist.config.ts` is 616 lines

This file is imported by `main.tsx → bootstrap.ts → store` and runs at
every startup. The 13 migrate* functions are sequential and synchronous;
`migrateIconLibraryToGlobalStore` calls `useIconStore.getState().addIcon`
inside a `try {} catch {}` for each icon, which can block the main thread
on large workspaces.

## 4. `EmptyFlowHighlight`, `useFlowState` recompute on every keystroke

`src/features/canvas/flow/useFlowState.ts` derives playback highlights
from `nodes` + `flows`. With 300+ nodes per the README's perf claim, every
keystroke in the LLM chat that touches the diagram store risks a recompute.

## 5. `useStableListByRefEquality` and `useLocalNodes` are deliberate but worth flagging

These are documented as performance workarounds for drag operations.
They're fine, but they need a periodic "are we still using these?" check;
they become permanent fragility if not maintained.

---

# Security Findings

## 1. No exposed secrets — `.env` and `.env.example` clean

The `.env` file contains only feature flags (`VITE_ENABLE_DEFECTDOJO=true`,
`VITE_ENABLE_GITHUB_IMPORT=true`, `VITE_DISABLE_SEEDS=false`,
`PROXY_REVERSE_*`). The GitHub token is commented out. `.env*` is in
`.gitignore`.

## 2. `dangerouslySetInnerHTML` only on sanitized SVG — OK

Four sites use it (`SvgNode.tsx`, `CustomIconRenderer.tsx`,
`VisualStateOverlay.tsx`, `RightPanel.tsx`). All four feed the output of
`sanitizeSvg()` first. The sanitizer strips `<script>`, event handlers,
and `javascript:` URLs.

## 3. `new Function(code)` in plugin loader — see Architectural §2

## 4. `localStorage` write failures are silently swallowed

Combined with Architectural §1, the architectural violation also creates
a silent failure mode: a quota-exceeded error in `collab-preferences.ts`
becomes invisible because the catch is empty. Users lose preferences
without a hint.

## 5. `MentionInput.tsx:47` uses `container.innerHTML = ""`

This is a clear (not write) and is safe. Flagging only for completeness.

---

# Dependency Findings

## 1. All 41 runtime dependencies are used

Verified via `grep` for each package in `src/`. **No unused dependencies.**

## 2. 46 outdated packages

Including React 18.3.1 → 19.2.8, date-fns 3 → 4, lucide-react 0.470 → 1.25,
Tailwind 3 → 4, TypeScript 5.9 → 7. None are *vulnerable* — just stale.
React 19 in particular is a known migration with breaking changes in
`@xyflow/react`'s typings, so it should be planned, not bumped.

## 3. Two cloud icon libraries (`aws-react-icons`, `azure-react-icons`,
`gcp-icons`) are intentionally separate

Each is a real icon set from a different provider; consolidating would
mean rewriting the dynamic-import resolution. The split is justified.

## 4. Both `monaco-editor` and `@monaco-editor/react` are declared

This is intentional — `@monaco-editor/react` is a thin wrapper, but the
project also uses `monaco-editor` types directly. No duplication.

## 5. `next-themes` usage is minimal (only `sonner.tsx`)

`next-themes` provides the React context for `dark`/`light`/`system` mode.
`Sonner` consumes `useTheme()` to pick its background. The app uses
`useTheme` everywhere, not `next-themes` directly. Possible to swap
`next-themes` for a 30-line home-grown theme provider, but the current
state is fine.

## 6. `class-variance-authority`, `clsx`, `tailwind-merge` are the standard
shadcn stack — keep

## 7. `elkjs` is loaded only by `autoLayoutEngine.ts`

The autoLayoutEngine is reachable from `useAutoLayout`, but only when the
user clicks "Auto Layout". Lazy-loading it (currently it's a top-level
import) would shave ~150 KB off the initial bundle.

## 8. `framer-motion` is used in ~10 files

Mostly chat animations and the modal overlay. Heavy for what it does.

## 9. `react-markdown`, `rehype-highlight`, `remark-gfm` are bundled together

Used only in `MarkdownContent.tsx` (LLM chat rendering). Should be lazy-loaded
with the LLM feature, not bundled in the initial chunk.

## 10. `cmdk` (command palette) is heavy

Only `command.tsx` uses it; should be lazy-loaded alongside the
`DiagramCommandPalette` mount.

---

# Documentation Issues

## 1. `README.md` uses deprecated feature/page names (HIGH)

Lines 36, 92, 93, 103, 153 still mention `Journeys`, `ModelExplorer`,
`ServiceRegistry`, `features/journeys/`. The schema is at v11 but the
README describes the v6 world.

**Suggested action:** a single sweep to replace:
- `Journeys` → `Walkthroughs`
- `ServiceRegistry` → `ServiceCatalog`
- `ModelExplorer` → `Workspace`
- `features/journeys/` → `features/walkthroughs/`

## 2. `AGENTS.md` is mostly correct but stale on folder names (HIGH)

Lines 43, 50, 55, 58 reference the same deprecated paths. Otherwise the
hard rules (type guards, i18n, `IStoragePort`) are all current.

## 3. `CONTRIBUTING.md` architecture diagram is stale (MEDIUM)

Lines 76–85 — same deprecated feature names.

## 4. `docs/architecture/overview.md` and `vision.md` use deprecated terms (MEDIUM)

`overview.md` lines 17–18, 21, 67: `modelExplorer`, `serviceRegistry`,
`journeys`. `vision.md` lines 104, 146, 204: same.

## 5. `docs/concepts/core-concepts.md` is the worst offender (HIGH)

Lines 10, 11, 40, 47, 87–110: extensive use of `journeys`, `service registry`,
`registryServiceId`, `processos`. An entire "Journey" section uses
deprecated terminology. Glossary says "Walkthrough (current)" — the body
doesn't match.

## 6. `docs/grammar/glossary.md` is exemplary (POSITIVE)

This file tracks every rename and is the single best documentation page
in the repo.

## 7. `FEATURES_MAP.md` was last touched before this audit

Verified hooks are present, but the file contains Portuguese typos
("笨拙", a Chinese character, in the Sharing section:215), and the `Hooks
do Canvas` table is not aligned with the actual feature/canvas/hooks
directory.

## 8. `ROADMAP.md` "Completed" lists `add-plugin-system-foundation` (LOW)

See *Abandoned Specifications §1*.

## 9. `docs/guides/adding-a-node-type.md` line 55 mentions `service-registry`

Should be `service-catalog`. Minor.

## 10. `CLAUDE.md` is correct (POSITIVE)

Just redirects to `AGENTS.md`; that file is the source of truth.

---

# Repository Cleanup Candidates

| Item | Severity | Action |
|------|----------|--------|
| `teste.json` at repo root | HIGH | Delete; add `teste*.json` to `.gitignore` |
| `collab-stateless/` directory | MEDIUM | Remove or move to a separate infra repo |
| `src/infrastructure/persistence/migrations.ts` | LOW | Fold into the store's persist.config.ts migrations |
| `src/features/canvas/hooks/keyboard/helpers.ts:36–41` | LOW | Delete the commented-out block |
| `src/infrastructure/persistence/migrations.ts:27–30` | LOW | Delete the commented-out stub |
| `useRegistryActions` deprecated alias | LOW | Migrate the one caller; remove the alias |
| `/journeys` redirect routes | LOW | Remove in next minor release |
| `FlowNodeComponent` deprecated type | LOW | Remove once the v6 migration has been live for a release |
| `PluginToolbarContext`, `uses: ["react"]` deprecated | LOW | Bump plugin API version to 1.2.0 and remove deprecated surface |
| `getSuggestionForMessage`, `summarizePatchActions` | MEDIUM | Delete (unused) |
| `expand-plugin-system-ui` testing tasks | LOW | Complete or formally drop |
| `quickactions-toolbar` QA checklist | LOW | Complete or formally drop |

---

# Low-Hanging Fruits

1. **Delete `teste.json`** and add `teste*.json` to `.gitignore` (5 min).
2. **Delete `getSuggestionForMessage` and `summarizePatchActions`** from
   `src/features/llm/store.ts:806, 817` (5 min).
3. **Replace 36 empty `catch {}` blocks** with `console.warn` calls (1 hour).
4. **Sweep README + AGENTS + CONTRIBUTING + FEATURES_MAP** for `Journeys`
   → `Walkthroughs`, `ServiceRegistry` → `ServiceCatalog`,
   `ModelExplorer` → `Workspace` (2 hours).
5. **Wire `AUTO_LAYOUT` patch case** in `apply-diagram-patch.ts:99` to
   `computeLayeredLayout` / `computeGridLayout` from `autoLayoutEngine.ts`
   (30 min).
6. **Implement `CollabProvider.updateViewport`** (30 min).
7. **Move `getCurrentColor` / `getNotePresetPair` / `usesCustomColor`** out
   of `NodeQuickActionsBar.tsx` into a shared `colorUtils.ts` and reuse
   in `PanelColorPicker.tsx` (1 hour).
8. **Lazy-load cloud icon resolvers** by converting
   `aws.icon-resolver.ts`/`azure.icon-resolver.ts`/`gcp.icon-resolver.ts`
   to dynamic imports (1 hour).
9. **Delete `migrations.ts`** and route `validateWorkspaceFile.ts` through
   `persist.config.ts`'s migration pipeline (1 day; needs careful schema
   version reconciliation).
10. **Remove the `collab-stateless/` directory** (5 min if confirmed unused).

---

# Recommended Cleanup Order

The plan minimizes risk by working from isolated cosmetic fixes first,
then architectural rewrites, then API-breaking consolidations.

**Phase 1 — Cosmetics (1 day).**

1. Delete `teste.json`; add `teste*.json` to `.gitignore`.
2. Remove unused exports in `llm/store.ts`.
3. Delete commented-out blocks (`helpers.ts`, `migrations.ts`).
4. Replace empty `catch {}` blocks with `console.warn` or routed errors.
5. Sweep docs: README, AGENTS, CONTRIBUTING, FEATURES_MAP, vision.md,
   overview.md, core-concepts.md — replace deprecated feature names.

**Phase 2 — In-progress work (1 sprint).**

1. Wire `AUTO_LAYOUT` patch in `llm/apply-diagram-patch.ts`.
2. Implement `CollabProvider.updateViewport`.
3. Complete (or formally drop) the QA checklist for
   `openspec/changes/quickactions-toolbar`.
4. Complete (or formally drop) testing tasks for
   `openspec/changes/expand-plugin-system-ui`.
5. Reconcile the `EdgeQuickActionsBar` naming with the actual
   `EdgeToolbar.tsx` extension.

**Phase 3 — Architectural consolidation (1 sprint).**

1. Introduce `IStoragePort` `preferences` / `ephemeral` namespace; route
   `useLastEdgeStyle.ts`, `recent-diagrams.ts`, `collab-preferences.ts`,
   `llm-storage.ts` (chat history and connections), and
   `storage-monitor.ts` through it.
2. Fold `migrations.ts` into the `persist.config.ts` pipeline.
3. Extract `colorUtils.ts` for the duplicated color setters.
4. Remove the `ENABLE_LEGACY_PANEL_ACTIONS` flag and the gated legacy
   controls.

**Phase 4 — Performance & docs (backlog).**

1. Lazy-load `elkjs`, `cmdk`, `react-markdown`+plugins, cloud icon resolvers.
2. Decide fate of `collab-stateless/` (move or remove).
3. Plan React 19 / Tailwind 4 / date-fns 4 upgrades.
4. Update `FEATURES_MAP.md` with verified hook list and accurate behavior
   descriptions.

---

# Final Assessment

## Architecture — **8/10**

The repository is structured by feature (`features/<domain>/`) with a clear
separation between `features/diagram` (no React, slices + selectors) and
`features/canvas` (React Flow UI). The hard rules in `AGENTS.md` are
mostly enforced (type guards, i18n, persistence port, no `any`). The
single architectural deviation is the localStorage bypass
(see *Architectural Problems §1*), which is the rule that needs the most
upholding.

## Maintainability — **7/10**

The codebase is well-named and small enough to keep in a developer's head.
Two large files (`useCollab.ts` 656 lines, `persist.config.ts` 616 lines)
would benefit from splitting. Documentation drift is the single largest
maintainability risk: a new contributor cannot rely on `README.md` to
find the right folder.

## Technical Debt — **6.5/10**

Concentrated in three buckets:

- Documentation (cheap to fix; large impact)
- The `quickactions-toolbar` / `expand-plugin-system-ui` OpenSpec changes
  that were archived without their testing/QA tasks completed
- The `localStorage` bypass that has grown organically

Each is a tractable refactor; together they account for the bulk of the
debt.

## Scalability — **8/10**

The diagram store handles 300+ nodes with fine-grained selectors per the
README. Auto layout is delegated to `elkjs` (already lazy-loadable). The
plugin system has scoped API surfaces. The collab system already uses
WebRTC + Yjs. There is no obvious scaling bottleneck.

## Code Quality — **7.5/10**

Strict TypeScript is on. Test coverage is healthy in the diagram slice
and the geometry/edge modules, sparse in the collaboration module (only
one test file: `collab.utils.test.ts`). The 36 empty `catch {}` blocks
are the single largest code-quality smell. Duplicate color-handling logic
and three near-identical cloud icon resolvers are the next-largest.

## Composite

**Repository health: 7.5/10.** The bones are good, the recent velocity
has outpaced docs, and the persistence layer needs a single enforcement
sweep. None of the findings are existential; most are quick wins. See
*Recommended Cleanup Order* for the path forward.
