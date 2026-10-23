# Tasks

## 1. Collapsed panels in the layout graph

- [x] 1.1 Exclude every descendant of a collapsed panel from `fromDiagram`'s scope, with the rule shared with `buildCollapsedPanelIds` and placed where the layout path can import it without the store. Verify with a `fromDiagram` test: a collapsed panel enters as a leaf at its stored size, its children and the edges to them are absent.
- [x] 1.2 Exclude collapsed panels from `resizableIds`. Verify with a `planDiagramAutoLayout` test: the plan carries no size for the collapsed panel and no entry for its descendants, and `collapsedWidth/Height` stay untouched.
- [x] 1.3 Run the layout baselines (`layoutReadability.baseline`, `generated-diagrams.baseline`, `layoutEngine`, `autoLayoutButton`). Verify they are unchanged. If a fixture holds a collapsed panel, update only that baseline and record the measured delta in the commit message.

## 2. Layout settings model and store

- [x] 2.1 Add `LayoutDensity` and `DiagramLayoutSettings` to `diagram.types.ts`, plus the optional `Diagram.layoutSettings`, exported through the model barrel. Verify with `npm run typecheck`.
- [x] 2.2 Add a pure `normalizeLayoutSettings`: drop default values, clamp the gaps to [40, 600], return `undefined` when everything is default. Verify with unit tests for defaults, clamping and invalid input.
- [x] 2.3 Extend `applyAutoLayout` with an optional `layoutSettings` written (normalised) in the same `set()` after the single `pushHistory`. Verify with a `layout.slice` test: one undo restores both the settings and the positions.
- [x] 2.4 Verify that a workspace persisted without `layoutSettings` loads unchanged, and that the field round-trips through the persistence port (localStorage and folder adapters). Verify with a persistence test; `PERSIST_SCHEMA_VERSION` stays as is.

## 3. Density-driven spacing in the engine

- [x] 3.1 Implement `elkSpacingFor(settings, labelled)` in `layoutEngine.ts` (factors 0.75 / 1 / 1.4 over the five spacing keys, overrides applied after, port spacing and padding untouched). Verify with a unit test that normal with no overrides deep-equals today's option objects.
- [x] 3.2 Give `layout()` an optional spacing argument and pass `settings` through `planDiagramAutoLayout`, including the `layout` handed to `chooseAutoRefs`. Verify with a test: on a reference diagram, spacious gives larger bounds and compact smaller bounds than normal, and the baselines stay identical.
- [x] 3.3 Read `diagram.layoutSettings` in `useAutoLayout` and `autoLayoutActiveDiagram`. Verify with a test: the assistant path and the hook path produce the same plan for a spacious diagram.
- [x] 3.4 Update the doc comment on `ELK_OPTIONS_INTERACTIVE` to say that density scales these values, and why padding and port spacing are excluded. Verify by review.

## 4. Animated transition

- [x] 4.1 Toggle `data-layout-animating` on the React Flow wrapper around the store write in `useAutoLayout`, cleared after 320 ms and on unmount. Verify with a hook test using fake timers.
- [x] 4.2 Add the canvas CSS: a transform transition on nodes except `.dragging`, edges and edge labels faded, `prefers-reduced-motion` turning it off. Verify by hand in `npm run dev`: nodes glide, edges reappear on their final routes, a drag started mid-transition does not lag, and reduced motion applies instantly.

## 5. Arrange split button and menu

- [x] 5.1 Add the `canvasToolbar.arrange.*` i18n keys (label, menu title, mode Manual/Automatic + "soon", the three densities with hints, advanced, layer gap, node gap, reset) in both `en.json` and `pt-BR.json`. Verify that the i18n key parity test passes.
- [x] 5.2 Build an `ArrangeControl` component in the bottom toolbar: the primary action arranges, the chevron opens the popover with the reserved mode row, the density radiogroup and the advanced sliders, hidden when the canvas is not editable. Verify with a component test for render, gating and accessible roles.
- [x] 5.3 Wire menu changes to plan with the candidate settings and apply them in one write. Debounce the sliders 250 ms, queue the latest request while a run is in flight (last one wins). Verify with a test that switching density saves the setting, re-arranges, and one undo reverts both.
- [x] 5.4 Document the Arrange control and the density semantics in `docs/concepts/` (auto-layout section) and add the shortcut hint to `ShortcutsModal` if it is missing. Verify by review.
- [x] 5.5 Add a "Restore defaults" action to the Arrange menu (normal density, no gap overrides, one undo step; disabled when already default). Verify with an `ArrangeControl` test.

## 6. Integration checks

- [x] 6.1 Run `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test` and `npm run fallow:check`. Verify all of them are green.
- [ ] 6.2 Manual pass in `npm run dev` with the pt-BR and en locales:
  - collapse a panel, arrange, and check that the room is freed; expand it and check that the children are intact;
  - switch between the three densities and undo each one;
  - check that the viewer shows the saved arrangement.
