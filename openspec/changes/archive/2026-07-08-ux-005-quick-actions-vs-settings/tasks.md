## 1. Branch and prep

- [ ] 1.1 Confirm the working branch is `feat/ux-005-quick-actions-vs-settings` and that it is off `feat/ux-004-quick-actions`.
- [ ] 1.2 Run `git log main..feat/ux-004-quick-actions --oneline` to confirm UX-004 is in the history of the new branch.

## 2. Add the locale keys

- [ ] 2.1 In `src/infrastructure/i18n/locales/en.json`, add: `nodeQuickActions.sectionVibrant`, `nodeQuickActions.sectionNeutral`, `nodeQuickActions.moreToggle`, `elementPanel.colorHintLabel`, `elementPanel.openQuickActions`.
- [ ] 2.2 Mirror the same keys in `src/infrastructure/i18n/locales/pt-BR.json` with Portuguese translations.

## 3. Expand the popover palette

- [ ] 3.1 In `src/features/canvas/panels/NodeQuickActions.tsx`, replace the `QUICK_ACTION_PALETTE` constant with imports of `VIBRANT_PRESETS` and `NEUTRAL_PRESETS` from `../ElementPanel/components/colorPresets`.
- [ ] 3.2 Add two small section labels ("Vibrant", "Neutral") above each row using `text-muted-foreground text-[10px] uppercase tracking-wide`.
- [ ] 3.3 Add a "More" / "Less" toggle button next to the Reset button. When collapsed, only the vibrant row is visible. When expanded, both rows are visible and the popover grows downward; the existing viewport clamp math flips to grow upward if there is no room below.
- [ ] 3.4 Keep the Reset button in the same top-right position; the "More" toggle sits between the Reset and the section labels.

## 4. Strip color from the ElementPanel

- [ ] 4.1 In `src/features/canvas/panels/ElementPanel/index.tsx`, remove the `ColorAccentSection` import and the JSX that renders it.
- [ ] 4.2 In `src/features/canvas/panels/ElementPanel/sections/PanelStyleSection.tsx` (or the equivalent file that contains a color subsection), remove the color subsection. The rest of `PanelStyleSection` (border style, etc.) stays.
- [ ] 4.3 Run a `grep -r "ColorAccentSection" src/` to confirm no other code path imports it. If something does, document and either remove the import or mark it as deprecated.

## 5. Add the color hint

- [ ] 5.1 Create a small `ColorHint` component at `src/features/canvas/panels/ElementPanel/components/ColorHint.tsx` that takes the current `selectedNode` and an `onOpenQuickActions` callback.
- [ ] 5.2 Render the hint at the top of the panel (above the basic fields). It shows: a small 8x8 swatch with the current color, the color name from the matching `colors.*` key, and an "Open Quick Actions" button.
- [ ] 5.3 Wire `onOpenQuickActions` from the parent to a no-op for now (the popover is not focusable by query in the current implementation; the button becomes the discoverability hint). The follow-up can add focus plumbing.

## 6. Document the classification

- [ ] 6.1 Create `src/features/canvas/panels/ElementPanel/QUICK_VS_STRUCTURAL.md` with two sections (`## Quick`, `## Structural`) listing the current classification.
- [ ] 6.2 Add a one-line note at the top: "When adding a field, update this list before merging."

## 7. Verify

- [ ] 7.1 Run `npm run typecheck` — must be green.
- [ ] 7.2 Run `npm run lint` — must be clean.
- [ ] 7.3 Run `npm run format` to normalize formatting.
- [ ] 7.4 Run `npm run test` — existing unit tests must still pass.
- [ ] 7.5 Run `npm run build` — must succeed.
- [ ] 7.6 Manual smoke (covering both UX-004 and UX-005 scenarios):
  - Select a C4 component → popover appears with vibrant row.
  - Click "More" → neutrals row appears, popover grows downward.
  - Click "Less" → popover shrinks.
  - Click outside the popover → popover dismisses.
  - Press `Esc` → popover dismisses.
  - Multi-select two nodes → popover does not appear.
  - Open the panel → color hint shows the current color and the "Open Quick Actions" button.
  - Confirm the panel does not render any color picker / swatch grid.
  - Drag a selected node → popover follows.

## 8. Commit and PR

- [ ] 8.1 Commit on the branch with a Conventional Commits message (e.g. `feat(canvas): extend Quick Actions palette and strip color from ElementPanel`).
- [ ] 8.2 Archive the OpenSpec change with `openspec archive` and commit the archive.
- [ ] 8.3 Open a PR against `main` and request review. Do not merge.
