## 1. Glossary and spec housekeeping

- [ ] 1.1 In `docs/grammar/glossary.md`, change the `Walkthrough` entry's `Status` from `proposed` to `current`; update the `Aliases` section to mark `Journey` as deprecated. Add a note that `Journey` is now free for future Customer Journey support.
- [ ] 1.2 In Appendix A of the glossary, move the `Journey` → `Walkthrough` row from `proposed` to `shipped (JOURNEY_STORE_SCHEMA_VERSION 2 / PERSIST_SCHEMA_VERSION 9)`.
- [ ] 1.3 In `docs/concepts/core-concepts.md`, drop the "Naming note" caveat under the Journey section; rewrite the section title and lead to use "Walkthrough" instead of "Journey" in the user-facing sense, while keeping the historical reference in a footnote.

## 2. Bounded context rename (`features/journeys/` → `features/walkthroughs/`)

- [ ] 2.1 `git mv src/features/journeys/ src/features/walkthroughs/`. Verify with `git log --follow` on a representative file.
- [ ] 2.2 Inside the folder, rename `journeys.store.ts` to `walkthroughs.store.ts`. The store hook `useJourneysStore` becomes `useWalkthroughsStore`; the legacy name is re-exported as a deprecated alias.
- [ ] 2.3 Inside `walkthroughs.store.ts`, rename the in-state field from `journeys: Record<string, Journey>` to `walkthroughs: Record<string, Walkthrough>`. Update the `partializeState` to emit `walkthroughs` instead of `journeys`. Update the merge / hydrate functions.
- [ ] 2.4 Rename types: `Journey` → `Walkthrough`, `JourneyStep` → `WalkthroughStep`, `JourneyPlayerMode` → `WalkthroughPlayerMode`, `JourneyPlayerState` → `WalkthroughPlayerState`, `JourneyRecordingTarget` → `WalkthroughRecordingTarget`, `JourneyPlaybackContext` → `WalkthroughPlaybackContext`, `JourneyPlayerProviderProps` → `WalkthroughPlayerProviderProps`. Deprecated aliases re-exported from `features/walkthroughs` for at least one release.
- [ ] 2.5 Rename hooks: `useJourneys` → `useWalkthroughs`, `useJourney` → `useWalkthrough`, `useJourneySteps` → `useWalkthroughSteps`, `useJourneyActions` → `useWalkthroughActions`. Deprecated aliases re-exported.
- [ ] 2.6 Rename components: `JourneyPlayerBar` → `WalkthroughPlayerBar`, `JourneyPlayerProvider` → `WalkthroughPlayerProvider`, `JourneyCard` → `WalkthroughCard`, `CreateJourneyModal` → `CreateWalkthroughModal`, `JourneyPlayerContext` → `WalkthroughPlayerContext`, `JourneyCompletedOverlay` → `WalkthroughCompletedOverlay`, `JourneyEditorCanvas` → `WalkthroughEditorCanvas`. Update default exports, display names, and `displayName` strings. Deprecated aliases re-exported.
- [ ] 2.7 Update the editor subcomponents (StepList, StepFlowPickerDialog, AddStepModal, RightPanel, StepDescriptionBadge, StepFlowSection, StepDetail, VisualStateOverlay) to import types from the renamed paths.
- [ ] 2.8 Update the hooks `useJourneyRecordingFinalize` → `useWalkthroughRecordingFinalize`, `useJourneyGlobalPlayer` → `useWalkthroughGlobalPlayer`, `useJourneyPlayer` → `useWalkthroughPlayer`, `useJourneyRecording` → `useWalkthroughRecording` (if it exists). Deprecated aliases re-exported.
- [ ] 2.9 Update the canvas integration hooks: `useJourneyCanvasHighlight` → `useWalkthroughCanvasHighlight` (lives in `features/canvas/chat/`) and `useJourneyViewportSync` → `useWalkthroughViewportSync` (lives in `features/canvas/hooks/`). Update consumers in `Canvas.tsx` and the canvas index.
- [ ] 2.10 Rename the canvas panel `JourneysInDiagramPanel` → `WalkthroughsInDiagramPanel`. Update its imports and the user-facing heading it renders.

## 3. Persistence

- [ ] 3.1 In the walkthrough store, introduce a `JOURNEY_STORE_SCHEMA_VERSION = 2` constant. Bump the diagram-store `PERSIST_SCHEMA_VERSION` to 9 in lockstep (the diagram store itself does not change shape with this migration, but the timeline is shared).
- [ ] 3.2 In the walkthrough-store persist config, change the localStorage key from `journeys-store` to `walkthroughs-store`. Add a `migrateJourneyToWalkthrough` function that reads the legacy `journeys` field, normalizes each entry (structural rename of `Journey` → `Walkthrough` and `JourneyStep` → `WalkthroughStep`; field-for-field identical otherwise), writes the new `walkthroughs` field, and deletes the legacy `journeys` field. Add a `migrateJourneyToWalkthrough` call in the merge / hydrate step. Idempotency: an already-v9 state is a no-op.
- [ ] 3.3 Update any place in the diagram store that reads or compares the walkthrough store's persisted key (e.g. `storage-monitor.ts`, `useFileSystemStorage.ts`, `workspace-manifest-fingerprint.ts`) to use the new key.

## 4. Page folder and routes

- [ ] 4.1 `git mv src/pages/journeys/ src/pages/walkthroughs/`. Verify with `git log --follow`.
- [ ] 4.2 Rename the default exports: `JourneysPage` → `WalkthroughsPage`, `JourneyEditorPage` → `WalkthroughEditorPage`. Update internal references.
- [ ] 4.3 In `src/App.tsx`, update the lazy imports and the route paths. The new routes are `/walkthroughs` and `/walkthroughs/:id/edit`. Add `<Route path="/journeys" element={<Navigate to="/walkthroughs" replace />} />` and `<Route path="/journeys/:id/edit" element={<Navigate to="/walkthroughs/:id/edit" replace />} />` so existing bookmarks redirect cleanly.

## 5. i18n

- [ ] 5.1 In `src/infrastructure/i18n/locales/en.json` and `pt-BR.json`, rename the `journeys` root namespace to `walkthroughs`. Update the string values to use the word "walkthrough" instead of "journey" / "jornada". Affected keys: `nav.journeys` → `nav.walkthroughs` (deprecated alias `nav.journeys` resolving to "Walkthroughs"), the entire `journeys.*` namespace, plus the `journeyNotFound`, `backToList`, `journeyCompleted`, `playJourney` keys.
- [ ] 5.2 Audit the `dashboard.*` and `*Journey*` substrings in user-facing values; update wording.

## 6. Player URL state

- [ ] 6.1 In `WalkthroughPlayerContext` and the player read paths, change the search-param keys from `journeyId` / `selectedStepId` to `walkthroughId` / `walkthroughStepId`. Read the new keys first; fall back to the legacy keys for backwards-compatible URL reading. The writer always emits the new keys.

## 7. Tests

- [ ] 7.1 Move `src/features/journeys/__tests__/journeys.store.test.ts` to `src/features/walkthroughs/__tests__/walkthroughs.store.test.ts`. Update all imports and identifiers inside.
- [ ] 7.2 Move `src/features/journeys/__tests__/step-media.utils.test.ts` to `src/features/walkthroughs/__tests__/walkthrough-step-media.utils.test.ts`. Update imports.
- [ ] 7.3 Add a unit test for the `migrateJourneyToWalkthrough` migration: load a v1 fixture, assert migrated to v2 with `walkthroughs` key, original `journeys` key absent, values intact. Add an idempotency test: load an already-v2 fixture, assert no double-rename.
- [ ] 7.4 Update or remove any test that imports `useJourneys`, `useJourney`, `useJourneySteps`, `useJourneyActions`, `JourneyPlayerProvider`, `JourneyPlayerBar`, `JourneyCard`, `CreateJourneyModal`, or `JourneyPlayerContext` to use the new names. Deprecated-alias smoke tests optional.

## 8. Plugin surface

- [ ] 8.1 In the plugin API surface (`features/plugins/plugin.types.ts` and `plugin-api.ts`), if any patch payload or docstring mentions `journeyId`, rename to `walkthroughId`. The legacy `journeyId` is recognized in patch payloads for at least one release (backwards-compatible decoding).
- [ ] 8.2 In any plugin example or test that reads `journeyId`, update to `walkthroughId`.

## 9. Verification

- [ ] 9.1 Run `npm run typecheck`, `npm run lint`, `npm run test`, `npm run format:check` — all green.
- [ ] 9.2 Manually load a workspace saved at v8, confirm the walkthroughs page renders with the previous walkthroughs and the navigation shows "Walkthroughs" (not "Journeys"). Save the workspace, reload, confirm the persisted state has `walkthroughs-store` only and no `journeys-store` key.
- [ ] 9.3 Manually load a workspace saved at v9 to confirm idempotency: the v9 state must remain unchanged after a save/reload cycle.
- [ ] 9.4 Spot-check the URL aliases: navigating to `/journeys` redirects to `/walkthroughs`; navigating to `/journeys/:id/edit` redirects to `/walkthroughs/:id/edit`. The player URL state accepts both legacy and new search-param keys.
