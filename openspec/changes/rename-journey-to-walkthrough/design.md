# Design — rename journey to walkthrough

## Scope boundary

The change is **a rename**, not a refactor. The Walkthrough data
model, the WalkthroughPlayer behavior, the recorder hooks, and the
journey store's persistence semantics are all unchanged. The change
touches only:

1. The bounded context folder (`features/journeys/` →
   `features/walkthroughs/`).
2. The page folder (`pages/journeys/` → `pages/walkthroughs/`) and
   the routes (`/journeys` → `/walkthroughs`).
3. The Zustand store module name, the persisted localStorage key,
   and the public hook names.
4. The i18n namespace (`journeys.*` → `walkthroughs.*`) and string
   values.
5. The TypeScript types (`Journey*` → `Walkthrough*`).
6. The player URL state keys (`journeyId` / `selectedStepId` →
   `walkthroughId` / `walkthroughStepId`).
7. The glossary (`proposed` → `current`).
8. The persisted JSON shape under a bumped schema version (the
   diagram-store schema bumps 8 → 9; the journey-store has its own
   schema key and bumps in lockstep).

The single decision that was not obvious: whether the migration is
on the diagram-store schema (which has a `PERSIST_SCHEMA_VERSION`)
or on the journey-store's own version. Today the journey store is a
**satellite store** with its own persist key (`journeys-store`),
separate from the main diagram-store's persist key (`diagram-store`).
The journey store does not currently expose a schema version. We
add one — `JOURNEY_STORE_SCHEMA_VERSION` — and bump it 1 → 2 with
this change. The diagram-store `PERSIST_SCHEMA_VERSION` also bumps
8 → 9 in lockstep, so any future change in either store can be
audited against a single timeline.

## Persistence migration

The journey store has its own persist config (separate from the
diagram store). The bootstrap looks like:

```ts
const PERSIST_KEY = "walkthroughs-store"; // was "journeys-store"
const JOURNEY_STORE_SCHEMA_VERSION = 2; // was 1

function migrateJourneyToWalkthrough(persisted: unknown): WalkthroughStore {
  const legacy = persisted as { journeys?: Record<string, Journey> };
  if (!legacy.journeys) {
    return persisted as WalkthroughStore;
  }
  const walkthroughs: Record<string, Walkthrough> = {};
  for (const [id, journey] of Object.entries(legacy.journeys)) {
    walkthroughs[id] = migrateOne(journey);
  }
  return { ...legacy, walkthroughs, _version: 2 };
}
```

`migrateOne` is a structural rename: every field of `Journey` and
`JourneyStep` is the same on `Walkthrough` and `WalkthroughStep`,
because we are not changing the data model. The function exists to
handle the type narrowing at the migration boundary; the underlying
JSON is byte-for-byte equivalent.

The `partializeState` of the journey store stops emitting the
`journeys` key and starts emitting `walkthroughs`. A v8 read
through the v9 migration moves the data; a v9 read of a v9
workspace is a no-op.

The diagram store's `PERSIST_SCHEMA_VERSION` bumps to 9 in lockstep
to keep a single timeline across both stores. The diagram store
itself does not change shape with this migration; only the
sibling journey store does. The bump is so consumers reading both
stores together can reason about a single version.

## Hook and store rename

`useJourneys`, `useJourney`, `useJourneySteps`, `useJourneyActions`
become `useWalkthroughs`, `useWalkthrough`, `useWalkthroughSteps`,
`useWalkthroughActions`. The legacy hooks are re-exported as
deprecated aliases from `features/walkthroughs` for at least one
release.

The internal store module is `walkthroughs.store.ts` (renamed from
`journeys.store.ts`). The export name of the Zustand store hook is
also renamed: `useJourneysStore` becomes `useWalkthroughsStore`.
The legacy name is re-exported as a deprecated alias.

## Page component and routes

`src/pages/journeys/` is moved to `src/pages/walkthroughs/`. The
default exports `JourneysPage` and `JourneyEditorPage` become
`WalkthroughsPage` and `WalkthroughEditorPage`. The lazy imports in
`App.tsx` are updated. The route paths change:

```diff
- <Route path="/journeys" element={<JourneysPage />} />
- <Route path="/journeys/:id/edit" element={<JourneyEditorPage />} />
+ <Route path="/walkthroughs" element={<WalkthroughsPage />} />
+ <Route path="/walkthroughs/:id/edit" element={<WalkthroughEditorPage />} />
+ <Route path="/journeys" element={<Navigate to="/walkthroughs" replace />} />
+ <Route path="/journeys/:id/edit"
+   element={<Navigate to="/walkthroughs/:id/edit" replace />} />
```

The redirect aliases are kept for at least one release.

## Player URL state

The player mode encodes the active walkthrough and step in the
URL. Today the search-param keys are `journeyId` and
`selectedStepId`. After the change they become `walkthroughId` and
`walkthroughStepId`. The reader is forgiving:

```ts
const walkthroughId = searchParams.get("walkthroughId") ?? searchParams.get("journeyId");
const selectedStepId = searchParams.get("walkthroughStepId") ?? searchParams.get("selectedStepId");
```

The writer always emits the new keys.

## i18n

The two locale files (`en.json`, `pt-BR.json`) are updated together.
The rename in each file is:

| Old key                         | New key                             | en value                  | pt-BR value                   |
| ------------------------------- | ----------------------------------- | ------------------------- | ----------------------------- |
| `nav.journeys`                  | `nav.walkthroughs`                  | "Walkthroughs"            | "Walkthroughs"                |
| `journeys.*` (root)             | `walkthroughs.*`                    | (mirror)                  | (mirror)                      |
| `journeys.title`                | `walkthroughs.title`                | "Walkthroughs"            | "Walkthroughs"                |
| `journeys.new`                  | `walkthroughs.new`                  | "New walkthrough"         | "Novo walkthrough"            |
| `journeys.empty`                | `walkthroughs.empty`                | "No walkthroughs yet"     | "Nenhum walkthrough ainda"    |
| `journeys.deleteConfirm*`       | `walkthroughs.deleteConfirm*`       | (mirror)                  | (mirror)                      |
| `journeys.duplicateJourneyName` | `walkthroughs.duplicateName`        | "{{name}} (copy)"         | "{{name}} (cópia)"            |
| `journeys.duplicated`           | `walkthroughs.duplicated`           | "Walkthrough duplicated." | "Walkthrough duplicado."      |
| `journeys.create.*`             | `walkthroughs.create.*`             | (mirror)                  | (mirror)                      |
| `journeys.step.*`               | `walkthroughs.step.*`               | (mirror)                  | (mirror)                      |
| `journeys.badge.*`              | `walkthroughs.badge.*`              | (mirror)                  | (mirror)                      |
| `journeys.inDiagram.*`          | `walkthroughs.inDiagram.*`          | (mirror)                  | (mirror)                      |
| `journeys.editor.*`             | `walkthroughs.editor.*`             | (mirror)                  | (mirror)                      |
| `journeys.journeyNotFound`      | `walkthroughs.walkthroughNotFound`  | "Walkthrough not found."  | "Walkthrough não encontrado." |
| `journeys.backToList`           | `walkthroughs.backToList`           | "Back to walkthroughs"    | "Voltar para walkthroughs"    |
| `journeys.journeyCompleted`     | `walkthroughs.walkthroughCompleted` | "✓ Walkthrough completed" | "✓ Walkthrough concluído"     |
| `journeys.playJourney`          | `walkthroughs.playWalkthrough`      | "Play walkthrough"        | "Reproduzir walkthrough"      |

The deprecated alias `nav.journeys` is kept resolving to
"Walkthroughs" so any code that still reads `t("nav.journeys")`
keeps working.

## File path conventions

The bounded context folder, the page folder, and the persisted
localStorage key are all renamed. The directory structure
under `features/walkthroughs/` mirrors the original
`features/journeys/` (components/editor, hooks, store, utils,
**tests**). Subcomponents inside the editor (StepList,
StepFlowPickerDialog, AddStepModal, etc.) keep their names — they
describe sub-concepts of a walkthrough, not the walkthrough itself.

## Verification

A workspace saved at v8 and reopened at v9 should:

1. Migrate the `journeys-store` localStorage entry to
   `walkthroughs-store` transparently on load.
2. Render the walkthroughs page at `/walkthroughs` with all
   walkthroughs intact.
3. Show "Walkthroughs" in the navigation entry (instead of
   "Journeys").
4. Continue to use the player UX (prev/next/play/record) without
   any behavior change.
5. Round-trip cleanly: save at v9, reload, find no
   `journeys-store` key in localStorage and the entries still in
   `walkthroughs-store`.
6. A bookmarked URL `/journeys` redirects to `/walkthroughs`;
   `/journeys/:id/edit` redirects to `/walkthroughs/:id/edit`.
7. The player URL state accepts both `journeyId` and
   `walkthroughId` (the latter is canonical).

The unit test for the migration asserts all seven properties on a
v8 fixture, an empty v9 fixture, and an already-v9 fixture
(idempotency).
