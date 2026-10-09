# Element catalog redesign — Phase 0 audit

Read-only audit for the floating toolbar + catalog popover + quick insert redesign.
Written against `main` @ `5dd1afc7` (branch `feat/element-catalog-toolbar`). Line numbers
refer to that commit.

---

## 1. Current "Adicionar elemento" modal

| What | Where |
| --- | --- |
| Component | `src/features/canvas/toolbar/ElementPickerModal.tsx` (667 lines) + `toolbar/element-picker/*` (~1.3k lines: sidebar, all-view, search results, AWS/cloud browse, services panel, filters, storage) |
| Only opener | `CanvasToolbar.tsx:95-111` (`+ Adicionar elemento` button, top-left stack), state `showModal` at `:56`, rendered at `:187-197` |
| Closed by | Esc (document capture listener `:174-184`), backdrop mousedown `:585-587`, X button, every insert, `isFlowActive` (`CanvasToolbar.tsx:80-85`) |
| Layout | `fixed inset-0 bg-black/40 backdrop-blur-sm` overlay, 760×520 card, left `CategorySidebar`, search input on top of the content column |
| Last category | `element-picker/storage.ts` → `localStorage["structura:lastElementCategory"]` |

**Insertion** — all paths call `useDiagramActions().addComponent(type, name, null, pos, serviceId?, panelKind?, flowShape?, createOptions?)`:

- Position: `getInsertPos()` `:242-245` = `screenToFlowPosition(window center)`. Note: the keyboard
  path uses `getViewportCenter(rf, isPanelOpen)` (`viewport-utils.ts`), which accounts for the
  320px inspector — the two disagree when the inspector is open.
- Handlers: `handleAddElement` `:247-268` (C4/canvas), `handleAddPaletteEntry` `:275-294`
  (registry grid, honours `createOptions`), `handleAddAws` `:296-309` (AWS services that map to a
  panel kind via `getPanelKindForAwsService` become a `panel`), `handleAddService` `:311-317`
  (business service → `system` + `linkComponentToService`), `handleAddCloudService` `:329-341`
  (casts `categoryId as ComponentType` — existing cast), `handleAddFlowNode` `:385-403`, presets
  via `instantiatePreset` `:551-554 / :646-649`.
- Name: `getDefaultNameForNewComponent(type, label, panelDefaultName)`.
- Store: `components.slice.ts:546-626` `addComponent` → `buildComponentForType` (descriptor
  `createComponent`) + `buildLayoutForComponent` (descriptor `defaultSize`), one `set()`,
  `pushHistory(state, STRUCTURAL)` **only when no scene/version is active** (`:577`).
- After insert: `onInsert(id)` → `CanvasToolbar.tsx:190-195` selects the new node.
- Usage tracking: `trackUsage(key)` (`toolbar/element-usage-tracker.ts`) on every insert. **Write-only
  today**: `getTopUsed` is exported but has no reader.

Two-`set()` inserts already in the modal: business service (`addComponent` + `linkComponentToService`)
and presets (`instantiatePreset` = `addComponent` + `updateComponent`, the second is a soft
checkpoint coalesced within `HISTORY_COALESCE_MS`=1500).

## 2. Small popover, CanvasSearch, palettes — and shortcuts

| Surface | File | Does | Opened by |
| --- | --- | --- | --- |
| **QuickInsertPopover** ("Buscar elemento…") | `toolbar/QuickInsertPopover.tsx` (749 lines) | 240px list: C4 always, everything else only when typing; ↑↓↵ via `selectedIndex` + `data-selected`; inserts at `flowPos + 20`; if `sourceNodeId` → `addConnection` after insert | right-click empty pane (pointer funnel `useCanvasEventHandlers.ts:105-117`, and `onPaneContextMenu` `:461-496`), **Shift+E** at cursor (`createToolShortcuts.ts:84-94`), connection drop on empty pane (`onConnectEnd` `:197-217`) |
| **CanvasSearch** | `toolbar/CanvasSearch.tsx` | Finds *existing* components on the canvas (name/desc/tech/tags), focuses them | ⌘F, ⌘/ (`createToolShortcuts.ts:96, 114`) |
| **DiagramCommandPalette** | `navigation/DiagramCommandPalette.tsx` | Diagram/folder switcher with recents | **⌘K** (`createToolShortcuts.ts:102-106`) |
| LLM chat | `llm/components/AssistantUIChatPanel.tsx:167-181` | ⌘K focuses the composer *only when the event target is inside the panel* | ⌘K (scoped) |

Shared code between them: none beyond `KEY/keyIs` and the hand-rolled ↑↓↵ pattern. The quick
insert and the modal duplicate all of their filtering (`pickerFilters.ts` vs. inline copies in
`QuickInsertPopover.tsx:63-80, 227-300`). None uses `cmdk`.

Existing bug found: quick insert merges flowchart matches into `flatOptions` (`:302-316`) but
never renders them, and the AWS/cloud/service/template offsets (`:502-507`) skip them — arrow
selection and ↵ target the wrong row whenever a flowchart shape matches.

**Shortcut ownership today** (canvas keydown: `dispatchCanvasKeydown.ts`, chain in `useCanvasKeyboard.ts:280-310`):

| Key | Owner |
| --- | --- |
| ⌘K | Diagram command palette (and chat composer when focus is in chat) |
| ⌘⇧K | Lock/unlock (`useLockShortcuts.ts:35`) |
| ⌘F, ⌘/ | CanvasSearch |
| ⌘B | Diagram sidebar |
| ⌘1-4 | Create C4 person/system/container/component (`useCanvasKeyboard.ts:110-118`) |
| ⌘⇧L | Auto layout (`canvasKeydownGates.ts:61-73`) |
| Shift+E | Quick insert at cursor |
| ⌘C/V/D/A/G/Z/Y, ⌘⇧W, Del/Backspace, Esc | edit chain |
| `/`, V, H, T, N, P, L, C (plain) | **free** |

**Proposed map**

| Key | Action | Note |
| --- | --- | --- |
| **⌘K** | Open catalog | Matches the design. Requires moving the diagram palette — **open question Q1** |
| ⌘P (proposed) | Diagram command palette | VS Code "go to file" convention; ⌘P (print) is preventable in-page. Alternative: keep ⌘K for diagrams and use ⌘I for the catalog |
| `/` | Quick insert at cursor | new; same gate as Shift+E |
| Shift+E | Quick insert at cursor | keep (documented in `shortcutsModal.quickInsertDesc`) |
| V / H / T / N / P / L / C | Toolbar tools | plain letters, only when no field is focused (already guaranteed by `shouldYieldCanvasShortcutToFocusedField`) — see §5 for which tools can exist |
| ⌘F, ⌘/ | CanvasSearch | unchanged |

Gate to update: `isCanvasOverlayOpen` (`canvasKeydownGates.ts:27-29`) must also be true while the
catalog or quick insert is open, otherwise Delete/⌘Z/plain-letter tools fire behind it when focus
leaves the input (e.g. on a chip). `ShortcutsModal.tsx` + `shortcutsModal.*` keys need the new
entries in both locales.

## 3. Registry metadata per element

Per `ElementDescriptor` (`elements/element.types.ts:418-438`) and palette slice (`:349-368`):

| Field | Exists | i18n |
| --- | --- | --- |
| label | `labelKey` | yes |
| description | `descriptionKey` (every element) | yes — usable by the preview panel |
| family | `family` | `elements.families.<id>.label` convention, falls back to id |
| category (chip) | `palette.categoryId` | catalog families: `CloudFamilyDefinition.labelKey`; fixed ones: `elementPicker.*` |
| icon | `palette.icon` (`lucide` \| `family` → `CloudIcon`), `variant.awsIconName` | — |
| variants | `palette.variants` (panel kinds, flowchart shapes, lines, cloud services) | `variant.labelKey` |
| spotlight | `palette.spotlight` | — |
| hidden | `palette.hidden` (shared-ref) | — |
| **synonyms** | `palette.searchKeys` / `variant.searchKeys` — **literal arrays mixing pt and en** (`["note","nota","sticky","postit"]`) | **no** |
| **tags** | none | — |

Cloud services (`CloudFamilyService`, `families/cloud-family.types.ts:27-48`): `id, name, iconName,
categoryId, descriptionKey?`. Their palette `searchKeys` are generated as
`[service.id, service.name, service.iconName]` (`build-cloud-family-descriptors.ts:30`) — no semantic
terms, so **`fila` matches nothing today** and `queue` matches only Azure "Queue Storage" by name.
Only OSS services set `descriptionKey`.

Catalog facts that affect the spec example `fila → SQS, Service Bus, Pub/Sub, Kafka`:
SQS (`aws-integration`), Service Bus and Queue Storage (Azure), Kafka (`oss-messaging`) exist.
**GCP has no Pub/Sub entry** (`gcp.catalog.ts` lists only categories/umbrella services) — adding it is
catalog work outside this epic.

Leftover parallel synonyms: `quickInsert.searchHelp*` i18n keys (pipe-separated); only
`searchHelpPanel`/`searchHelpSwimlane` are read (`QuickInsertPopover.tsx:219-225`); the other five are dead.

Prior art: `llm/element-catalog-query.ts:130` `searchElements` already walks every non-catalog
family + every catalog service with descriptions (English only, substring, no ranking). The new
index should not duplicate its traversal — see S1.

**Proposal — semantic concepts (not implemented)**

- New shared vocabulary `features/elements/search/concepts.ts`: a closed list of concept ids
  (`queue`, `pubsub`, `database`, `cache`, `gateway`, `storage`, `decision`, `actor`, …).
- Terms per concept live in i18n: `elements.concepts.<id>.terms` = `"fila|mensageria|queue"` in
  pt-BR and `"queue|messaging"` in en. The index reads **both** locales regardless of the active
  one (a pt-BR user typing `queue` must still hit SQS), normalised accent-insensitive.
- Opt-in fields, each read by the S1 index in the same commit:
  `ElementPaletteSlice.concepts?` / `ElementPaletteVariant.concepts?` and
  `CloudFamilyService.concepts?` (propagated to the variant by `build-cloud-family-descriptors`).
- `matchedOn` ranks: name > synonym (`searchKeys`, kept as-is, locale-free) > tag (concept term).
- The existing literal `searchKeys` stay (they are proper nouns/abbreviations mostly); moving
  their pt words into concepts can follow later.

## 4. Presets

- Type `element-presets/types.ts` (`ElementPreset { id, name, description?, category?, baseType, data, serviceId?, … }`).
- Store `element-presets/store/element-presets.store.ts` (zustand persist, key `ELEMENT_PRESETS_ZUSTAND_KEY`,
  mirrored by `infrastructure/persistence/elementPresetStore.ts`).
- Library hook `hooks/useElementPresetLibrary.ts` — `instantiatePreset` (two `set()`s, see §1).
- In the modal: `NodeTemplate` category ("Meus presets", `elementPresets.myPresets`) grid of
  `ElementPresetPreviewCard` with delete (`ElementPickerModal.tsx:542-565`) and a search section.
- Save: `SaveElementPresetModal` opened from the node context menu (`Canvas.tsx` `templateSourceNode`),
  built with `createPresetDataFromNode(node, component)` — **needs a canvas node**. The spec's
  "Save as preset" in the preview panel has no node yet → **open question Q4**.
- Drag: canvas wrapper already accepts `ELEMENT_PRESET_DRAG_MIME` drops (`Canvas.tsx:357-377`) —
  the drop target to extend for catalog tiles (new MIME, same handler). Drop inserts at top level
  (no panel parenting), same as presets today.

## 5. Canvas toolbars and tools

Existing:
- `CanvasToolbar.tsx` — top-left 220px column: diagram panel, versions, layer filter, drill up,
  Patterns, plugin slot, **Add element**. Collapsible (`structura:toolbar-collapsed`).
- Bottom-left: React Flow `Controls` + `CanvasViewOptions` (`Canvas.tsx:489-493`).
- Bottom-right: MiniMap (`!mb-20`, above the floating chat button). **Bottom-center is free** in
  the editor (only the viewer's `FlowInvite` uses it, different route).

Tool spec vs. reality:

| Tool | Status |
| --- | --- |
| Select (V) | **Missing as a mode.** Selection is the pointer funnel + `selectionOnDrag` (`reactFlowBaseConfig.ts:100-104`). A mode switch changes `panOnDrag`/`selectionOnDrag` → touches the selection system (out of scope) |
| Pan (H) | **Missing.** Same reason |
| Text (T) | **Missing — no text element exists** (closest: `note`). Needs a new `ElementDescriptor` |
| Note (N) | exists — `note` palette entry (insert-at-center) |
| Panel (P) | exists — `panel` default variant |
| Swimlane (L) | exists — `panel` variant `panelKind: swimlane` |
| Connector (C) | **Missing.** No edge-drawing tool; edges are drawn from handles only |
| C4 ▾ / Flowchart ▾ | Insert actions exist; dropdowns are new UI (use `dropdown-menu.tsx`) |

So in S2 Note/Panel/Swimlane are "insert at viewport center" buttons, not modes. **Q2.**

The old top-left `Add element` button and the Patterns button: the spec does not say where
Patterns goes once the add button moves. **Q3.**

## 6. Connection drop on empty pane

- `onConnectEnd` exists: `useCanvasEventHandlers.ts:197-217`, passed through `Canvas.tsx:414` →
  `DiagramSurface.tsx:114`. On a drop with `fromNode && !toNode` it opens quick insert with
  `sourceNodeId`.
- On pick, `QuickInsertPopover.tsx:336-355` calls `addComponent(...)` then
  `addConnection(source, newId, t("canvas.usesEdgeLabel"), getLastEdgeStyle())`.
  **That is two `set()`s and two `STRUCTURAL` checkpoints → two undos today.** The side handle the
  drag started from is not forwarded either (`sidesFromHandles` is only used by `onConnect`).
- `addConnection` (`connections.slice.ts:35-71`) builds the `Connection` inline and enforces
  `canBeConnectionSource`. Precedent for node+edge in one `set()`: `insertGeneratedGraph`
  (`generated-graph.slice.ts`) — but it takes generated input (no `createOptions`/`flowShape`,
  no existing source, no edge style).

Proposed: new action `addComponentConnectedFrom(sourceId, type, name, position, createArgs, edge)`
in `components.slice.ts`, one `set()`, one `pushHistory(STRUCTURAL)` first, reusing
`buildComponentForType` / `buildLayoutForComponent` / `writeComponentAndLayout` and a small pure
`buildConnection(...)` extracted from `addConnection` (which then calls it — behaviour unchanged).
That is a refactor of the connections slice, **not** of edge rendering/routing internals. Flagging
it per the prompt's rule anyway — **Q5**.

## 7. Where user UI preferences persist

- Pattern in use: `features/canvas/preferences/canvas-preferences.store.ts` — zustand `persist`,
  `localStorage` key `structura:canvas-preferences` (scrollMode, showMiniMap). Not in the diagram,
  not in history, not in collab.
- Others: `structura:toolbar-collapsed`, `structura:lastElementCategory`, `structura_element-usage`
  (all direct `localStorage`, despite the `IStoragePort` rule in AGENTS.md — the rule is violated
  by ~20 UI-pref call sites today).
- Recent *diagrams*: `diagram/utils/recent-diagrams.ts` + `navigation/useRecentDiagrams.ts`.

Proposal: Recents = `recentElementKeys: string[]` (cap 8, most recent first, key = index entry id)
in `canvas-preferences.store.ts`. Retire `element-usage-tracker.ts` (write-only) and
`element-picker/storage.ts` in S5.

## 8. UI primitives available

`src/components/ui/`: `command.tsx` (cmdk 1.1.1 — used by `TechnologyCombobox`, `ServiceCombobox`),
`popover.tsx` (Radix), `tabs.tsx`, `badge.tsx`, `tooltip.tsx`, `dropdown-menu.tsx`, `button.tsx`,
`input.tsx`, `dialog.tsx`.

Recommendation: `Command` with `shouldFilter={false}` (ranking comes from the S1 index) gives
`aria-activedescendant`, ↑↓, ↵ and `onSelect` for the search list and quick insert. The browse
grid (4-column tiles) needs 2-D arrows, which cmdk does not do — a small roving-focus grid there.
Radix `Popover` gives anchoring, focus trap-ish behaviour (`FocusScope`), Esc and focus return to
the trigger. Quick insert anchors to a point, not a trigger: use `Popover` with a virtual anchor
(`PopoverAnchor` at the screen point).

## 9. Tests to update

| Test | Touches |
| --- | --- |
| `elements/structural-family-contract.test.ts:15,130` | `buildCategoryNavItems` |
| `elements/families/cloud-family-contract.test.ts:18,115` | `buildCategoryNavItems` |
| `elements/families/deploy/deploy.family.test.ts:8,24` | `buildCategoryNavItems` |
| `elements/families/k8s/k8s.family.test.ts:5,27` | `buildCategoryNavItems` |
| `elements/single-owner.invariant.test.ts:5` | `buildCanvasPickerOptions` |
| `canvas/toolbar/element-picker/buildFlowchartPickerOptions.test.ts` | flowchart options |
| `canvas/hooks/useCanvasEventHandlers.{edge,endpoint}-click.test.tsx` | `setQuickInsert` mock |
| `cypress/e2e/right-button-context-menu.cy.ts:110` | identifies quick insert as "the only popover with a search `<input>`" — breaks once the catalog also has one |

These contract tests assert "every registered category is reachable from the picker" — they
should be re-pointed at the S1 index's family/category derivation, not deleted.

Baseline on clean `main`: `npm test` → 7 failures, all pre-existing and unrelated
(`canvas/layout/generated-diagrams.baseline.test.ts` ×6, `layoutReadability.baseline.test.ts` ×1).

---

## Proposed slice plan (adjusted)

- **S1 — Search index** in `src/features/elements/search/` (not `@/features/diagram`: it reads the
  element registry and i18n, which the diagram domain does not own). Pure TS, no React. Builds
  entries from `offeredElements()` (+ variants) and `allCloudFamilies()`; presets and business
  services passed in by the caller. Normalise (NFD, strip marks, lowercase); rank
  exact > prefix > contains (name) > synonym > concept; `matchedOn` + ranges; family/category
  counts derived. Adds `concepts` (§3) with its first reader. Seeds concepts for the spec's
  examples (queue, decision). Vitest.
- **S1b — Store action** `addComponentConnectedFrom` (§6) + test "one undo removes node + edge".
  Split out so it can be reviewed alone (Q5).
- **S2 — Floating toolbar** (bottom-center): Note/Panel/Swimlane insert buttons, C4 ▾,
  Flowchart ▾, Catalog toggle; Select/Pan/Text/Connector only per Q2.
- **S3 — Catalog popover** (browse + search + preview + drag), Recents in canvas preferences,
  overlay gate (§2), shortcut per Q1.
- **S4 — Quick insert**: rewrite `QuickInsertPopover` on the S1 index + `Command`; triggers
  double-click pane (native `dblclick` on the canvas wrapper filtered to `.react-flow__pane`, so the
  pointer funnel is untouched — needs a browser check that d3/selection does not swallow it), `/`,
  Shift+E, right-click (Q6), connection drop via S1b.
- **S5 — Remove** `ElementPickerModal`, `element-picker/*` (except what S3 reuses),
  `element-usage-tracker`, dead i18n keys (`elementPicker.*` no longer read, `quickInsert.searchHelp*`),
  `canvasToolbar.addElement`; update tests in §9.

## Risks

1. **⌘K collision** with the diagram palette and documented shortcut help (Q1).
2. **Double-click on the pane**: React Flow has no `onPaneDoubleClick`; with `selectionOnDrag`
   the pane routes clicks through pointer handlers. If native `dblclick` does not reach the
   wrapper reliably, the fix lives in the pointer funnel = selection system (out of scope → STOP).
3. **Scene/version mode**: `addComponent`/`addConnection` skip history inside a scene; the new
   action must keep that, or one undo will not mean the same thing in both modes.
4. Insert position: modal uses window center, keyboard uses `getViewportCenter(isPanelOpen)` —
   pick one (proposal: `getViewportCenter`).
5. Index size: AWS ≈ 160 services + Azure/GCP/K8s/OSS ≈ 150 → build once per language change
   (memo on `i18n.language`), search is O(n) per keystroke; fine, but must not subscribe to the
   diagram store (the "no canvas re-render while typing" requirement).
6. Catalog tiles dropped on a panel will insert at top level (same as presets today), not inside
   the panel — consistent but maybe surprising.
7. `fila → Pub/Sub` cannot pass: GCP catalog has no Pub/Sub.

## Open questions

- **Q1** — ⌘K: move the diagram palette to ⌘P and give ⌘K to the catalog? (Recommended.) Or keep
  ⌘K for diagrams and use ⌘I for the catalog?
- **Q2** — Select/Pan/Text/Connector don't exist. Ship S2 with only Note/Panel/Swimlane +
  dropdowns + Catalog (recommended), deferring modes to the selection epic and Text to a new
  element?
- **Q3** — Where do Patterns (and the plugin toolbar slot) live once "Add element" leaves the
  top-left stack? Proposal: leave them where they are.
- **Q4** — "Save as preset" from the preview panel has no node to read. Drop it from the preview
  (recommended), or create a preset from the descriptor defaults?
- **Q5** — Approve `addComponentConnectedFrom` + extracting a pure `buildConnection` from
  `addConnection` in `connections.slice.ts`?
- **Q6** — Keep right-click-on-empty-pane → quick insert (today's behaviour, covered by Cypress)
  alongside double-click and `/`?
- **Q7** — Approve `concepts` (i18n terms, both locales searched) as the synonym/tag model, with
  the new optional fields on `ElementPaletteSlice`, `ElementPaletteVariant` and `CloudFamilyService`?
