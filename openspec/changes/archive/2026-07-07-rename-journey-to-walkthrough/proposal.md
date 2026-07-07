## Why

The Structura feature currently named `Journey` is a curated or recorded
sequence of steps across one or more Diagrams, with a VCR-style player
(prev/next, play, record). It is used for onboarding, demos, incident
retrospectives, and executive walkthroughs. The name `Journey` collides
with three other well-established uses of the word in software:

- **Customer Journey** (UX): a map of experience across touchpoints
  (Allen, Stickdorn, Schneider). Structura does not model this.
- **BPMN journey / process journey**: an ordered set of activities with
  gateways and timers. Structura steps are not activities.
- **Marketing / e-commerce journey**: a funnel narrative for prospects
  and customers. Structura is a tool for architects, not marketers.

The name is overloaded enough that every external reader miscalibrates
their expectation. The `docs/grammar/glossary.md` already marks `Journey`
as `deprecated` in favor of `Walkthrough` (the term the player UI itself
uses — "walkthrough of diagrams"). This change ships the rename.

The migration is purely cosmetic in the sense that no behavior changes,
but it is the largest of the three naming renames the glossary tracks
(Tier 3, after process-node and serviceCatalog). It touches the
`features/journeys/` bounded context, the `/journeys/*` route, the i18n
catalog, the `Journey*` types, the `journeys` Zustand store, the
`JourneyPlayer*` components, and the `journeys.*` i18n namespace. A
persistence migration is required because the user-authored Walkthrough
records are persisted client-side under a `journeys` key.

The name `Journey` is freed up for a future Customer Journey
implementation, which the glossary reserves under the same name.

## What Changes

- **Persisted state**: the journeys store (the separate satellite store
  holding `Record<id, Journey>`) is renamed to a walkthroughs store
  holding `Record<id, Walkthrough>`. The persisted localStorage key
  changes from `journeys-store` to `walkthroughs-store`; a forward-only
  migration in the journey-store bootstrap reads the old key, copies
  each entry (translating `Journey` to `Walkthrough` and `JourneyStep`
  to `WalkthroughStep` field-for-field), and writes the new key. The
  old key is dropped after a successful read. Idempotent: a v9 read on
  an already-v9 state is a no-op.
- **Bounded context**: `src/features/journeys/` is renamed to
  `src/features/walkthroughs/` via `git mv`. The Zustand store module
  is `walkthroughs.store.ts`; the public hook
  `useJourneys`/`useJourney`/`useJourneySteps`/`useJourneyActions`
  become `useWalkthroughs`/`useWalkthrough`/`useWalkthroughSteps`/
  `useWalkthroughActions`. Deprecated aliases re-export the new hooks
  for at least one release. The `JourneyPlayerProvider` /
  `JourneyPlayerBar` / `JourneyCard` / `CreateJourneyModal` /
  `JourneyPlayerContext` are renamed to `Walkthrough*` equivalents.
- **Page**: `src/pages/journeys/` is renamed to
  `src/pages/walkthroughs/`. The default export `JourneysPage`
  (the list view) becomes `WalkthroughsPage`; the editor page
  `JourneyEditorPage` becomes `WalkthroughEditorPage`. The lazy imports
  in `App.tsx` are updated. The route changes from `/journeys` to
  `/walkthroughs`, and from `/journeys/:id/edit` to
  `/walkthroughs/:id/edit`. The old routes are kept as redirect-only
  aliases in the router for one release to avoid breaking bookmarks.
- **i18n**: every key under the `journeys.*` namespace in `en.json` and
  `pt-BR.json` is renamed to `walkthroughs.*`. The `nav.journeys`
  key becomes `nav.walkthroughs`; the `nav.journeys` key is kept as a
  deprecated alias resolving to the same value ("Walkthroughs" /
  "Walkthroughs"). String values that contain the word "journey" or
  "Journey" are updated to "walkthrough" / "Walkthrough" (e.g.
  `"Walkthrough not found."`, `"Back to walkthroughs"`,
  `"Walkthrough duplicated."`).
- **Types**: `Journey` (the type) and `JourneyStep` become
  `Walkthrough` and `WalkthroughStep`; `JourneyPlayerMode`,
  `JourneyPlayerState`, `JourneyRecordingTarget`,
  `JourneyPlaybackContext`, `JourneyPlayerProviderProps` follow the
  same pattern. Deprecated aliases are re-exported from
  `features/walkthroughs` for at least one release.
- **Player URL state**: the player mode encodes `journeyId` and
  `selectedStepId` in the URL search params. After this change the
  search-param keys become `walkthroughId` and `walkthroughStepId`.
  Backwards-compatibility: when reading the URL, the player first
  checks for the new keys and falls back to the legacy ones if absent
  (covering bookmarks that point to the old player URL).
- **Glossary / docs**: `docs/grammar/glossary.md` updates the
  `Walkthrough` entry from `proposed` to `current`; `docs/concepts/
core-concepts.md` drops the Journey "naming note" caveat; the
  Appendix A row moves to "shipped (PERSIST_SCHEMA_VERSION 9)".

## Capabilities

### New Capabilities

_None — this is a rename of an existing concept that the plugin-system
spec already covers in passing._

### Modified Capabilities

- `plugin-system`: the plugin API exposes `journeyId` in some
  patch payloads; the renamed `walkthroughId` is the new canonical
  name. The legacy `journeyId` field is recognized in patch payloads
  for at least one release.

## Impact

- **Bounded context**:
  - `src/features/journeys/` → `src/features/walkthroughs/`. All
    internal files renamed (store, hooks, components, utils, types,
    tests). The default exports of the module-level barrel
    (`useJourneys`, `useJourney`, `useJourneySteps`,
    `useJourneyActions`, `useJourneyPlayer`, `useJourneyRecording`,
    `useJourneyCanvasHighlight`, `useJourneyViewportSync`,
    `JourneyPlayerBar`, `JourneyPlayerProvider`, `JourneyCard`,
    `CreateJourneyModal`, `JourneyPlayerContext`) become their
    `Walkthrough*` counterparts. Deprecated aliases re-export.
  - Persisted localStorage key changes from `journeys-store` to
    `walkthroughs-store`. A forward-only migration reads the old
    key, normalizes the shape, and writes the new key.
- **Page**:
  - `src/pages/journeys/` → `src/pages/walkthroughs/`. The two
    default exports (`JourneysPage`, `JourneyEditorPage`) become
    `WalkthroughsPage`, `WalkthroughEditorPage`.
  - `src/App.tsx`: route paths `/journeys` → `/walkthroughs` and
    `/journeys/:id/edit` → `/walkthroughs/:id/edit`. The old paths
    are added as `<Route path="/journeys" element={<Navigate
to="/walkthroughs" replace />} />` and the same for the editor
    path, so existing bookmarks redirect cleanly.
  - The `useJourneyCanvasHighlight` and `useJourneyViewportSync`
    hooks are renamed and re-exported. Consumers in the canvas
    (`features/canvas/canvas/Canvas.tsx`, `features/canvas/hooks/`,
    `features/canvas/panels/JourneysInDiagramPanel.tsx`) are updated
    to import from the new path and to call the new hook names.
- **i18n**:
  - `en.json` and `pt-BR.json`: rename the `journeys` root namespace
    to `walkthroughs`. Each user-facing string is updated to use the
    word "walkthrough" instead of "journey" (en) / "jornada" (pt-BR).
    `nav.journeys` is renamed to `nav.walkthroughs` and the legacy
    key kept as an alias. The other consumers of journey strings
    inside the canvas (the `JourneysInDiagramPanel` heading, the
    `in-journey` tooltip, the journey-player context label) read
    from the new namespace.
- **Tests**:
  - `src/features/journeys/__tests__/journeys.store.test.ts` is moved
    to `src/features/walkthroughs/__tests__/walkthroughs.store.test.ts`
    and its imports / names updated. The
    `step-media.utils.test.ts` is renamed to
    `walkthrough-step-media.utils.test.ts`.
  - Any consumer of `useJourneyActions`, `useJourney`, etc. in tests
    updates to the new names; the deprecated aliases are
    smoke-tested (a single import-and-call is enough).
- **Persistence semantics**:
  - Workspaces on v8: the migration runs once on load, copies the
    journeys store under the new key, deletes the old one. A v9
    state already has the new key, so the migration is a no-op.
  - URL state for the player: when the player reads the URL, it
    checks `walkthroughId` and `walkthroughStepId` first; if
    absent, it falls back to `journeyId` and `selectedStepId`. The
    canonical write is always under the new keys.

## Non-Goals

- Not modeling a Customer Journey. The rename frees the term
  `Journey` for a future Customer Journey implementation; that is
  a separate spec.
- Not changing the Walkthrough data model. The `WalkthroughStep`
  shape (label, description, duration, diagramId, flowId, media,
  order) is unchanged.
- Not changing the WalkthroughPlayer behavior. The VCR-style
  prev/next/play/record UX is unchanged.
- Not removing the old URL paths. They are kept as
  `<Navigate replace />` aliases for at least one release.
- Not changing the plugin-system panel slot id (`journey` is not a
  panel slot id; the plugin contract is unaffected beyond the
  field-name rename `journeyId` → `walkthroughId` in patch payloads,
  which is backwards-compatible for one release).
- Not unifying with `registryServiceId` / `serviceId`; that is a
  separate spec tracked in the glossary.
