## Context

UX-004 (`openspec/changes/ux-004-quick-actions`) shipped the Quick Actions popover with a fixed 8-color palette and a Reset button. It is a minimal viable "quick action": one field, one control, no classification policy. The popover lives at `src/features/canvas/panels/NodeQuickActions.tsx` and is mounted in `Canvas.tsx` next to the ElementPanel.

The ElementPanel (`src/features/canvas/panels/ElementPanel/index.tsx`) currently renders every node field, including color. The color section is `ColorAccentSection` (imported from `./sections`), and a small subsection of `PanelStyleSection` may also render a color swatch. The panel is mounted with the same `showElementPanel` gate as the popover, so when the popover is open, the panel is open too — and the panel still has a full color picker. That duplication is the symptom UX-005 fixes: today the user can change the same color in two places, and the panel's picker is the heavier of the two.

The existing palette constants live in `src/features/canvas/panels/ElementPanel/components/colorPresets.ts`:

- `VIBRANT_PRESETS` — 15 colors (blue → sky).
- `NEUTRAL_PRESETS` — 6 grays (grayDark → gray).
- `PANEL_PRESETS` — concatenates the two (21 total).
- `ColorPreset` shape: `{ nameKey: string; color: string }`.

The popover already pulls from this file via the constant `QUICK_ACTION_PALETTE`; switching to the full `PANEL_PRESETS` is a one-line change at the data layer.

## Goals / Non-Goals

**Goals:**

- The popover offers the full vibrant palette by default and a "More" toggle for neutrals, so users do not need to open the panel to pick from the 21 colors the panel offers today.
- The ElementPanel drops its color editing surface (no `ColorAccentSection`, no color subsection in `PanelStyleSection`) and replaces it with a one-line hint that mirrors the popover state and points the user to the popover.
- The classification (Quick vs Structural) is recorded in a markdown file checked in alongside the panel, so the next field add follows the same rule.
- Existing UX-004 behavior is preserved (anchoring, dismissal, Reset, drag-follow, single-node gate).
- i18n stays in both locales with no key left untranslated.

**Non-Goals:**

- No quick actions for **edge direction / edge style** (still a follow-up).
- No quick actions for **multi-selection** (still a follow-up).
- No free-form color picker.
- No reorganization of the rest of the ElementPanel.
- No touch / stylus specific gestures.
- No new store actions.
- No new dependencies.

## Decisions

- **Popover size stays the same at rest.** The "More" toggle starts collapsed; clicking it reveals the neutral row. The popover grows downward by ~28px when expanded, with the same viewport clamping already in `NodeQuickActions.tsx` (the existing math flips to grow upward when there is no room below).
- **Section labels are tiny.** A 10px uppercase label above each row (`Vibrant`, `Neutral`), color `text-muted-foreground`, no background. Labels add 14px to the at-rest popover height, which keeps the popover under 50px tall when collapsed — close to today's ~28px but with the section divider visible.
- **The "More" toggle is a button, not a checkbox.** Label: "More" / "Less", positioned to the right of the Reset button. The button uses the same border and text style as the Reset button.
- **Color hint in the ElementPanel** lives at the top of the `BasicFieldsSection`. It is a one-line row with: a small color swatch (8x8px), the color name from the existing `colors.*` key, and an "Open Quick Actions" button. The button is a no-op if the popover is already open (focus call works only when the popover is mounted); it is hidden in locked modes where the popover is not available.
- **Removing the color section from the panel** is a one-file change: stop importing `ColorAccentSection` in `ElementPanel/index.tsx` and stop rendering it. If a color subsection lives inside `PanelStyleSection`, that subsection is removed; the rest of `PanelStyleSection` (border style) stays.
- **Document at `ElementPanel/QUICK_VS_STRUCTURAL.md`** is a short list, not a long design doc. Two headings (`## Quick`, `## Structural`) and one line per field. The line is enough to drive a future PR review; the rest is in the spec.
- **No new store actions.** Both the popover and the removed panel section went through `updateComponent`; nothing changes. The panel hint is a read-only display of the current color, derived from `node.data` (already in scope).
- **No new dependencies.** The popover already uses `lucide-react` for the `X` icon; the "More" toggle reuses the same button style.
- **Coexistence invariant:** if the popover is dismissed while the panel is open, the panel hint continues to read the current color correctly. If the panel's color is changed through some other path (today: via the panel picker being removed, so "other path" does not exist), the popover would also need to reflect it — the existing UX-004 scenario covers this.

## Risks / Trade-offs

- **[Hint discoverability]** Users who only ever opened the panel to change color will be confused when the picker is gone. _Mitigation_: the hint label is "Edit in Quick Actions" (a verb) and the panel still shows the current color in plain text. The hint button is the "where to go" pointer.
- **[Popover width grows when expanded]** 15 vibrant swatches at 20px + gaps = ~360px. Today's popover is ~250px wide. The wider popover still fits on most viewports; the existing clamp pushes it left when there is no room on the right. _Mitigation_: the popover already supports the left-anchored fallback; no new clamp logic needed.
- **[ColorAccentSection removal breaks a public-ish surface]** The `ColorAccentSection` is exported from `sections/index.ts` and may be imported by other code paths. _Mitigation_: grep before removal. If anything imports it outside the panel, the change either moves the import to a re-export (deprecated) or pulls the section into the panel under a new name. Worst case is a follow-up rename.
- **[Read-only hint gets mistaken for a clickable swatch]** The 8x8 swatch in the panel hint is read-only but visually similar to a clickable swatch. _Mitigation_: no hover state, no border, the row is keyed by a clear label. The "Open Quick Actions" button is the only interactive element on the row.
- **[Markdown doc drifts from reality]** `QUICK_VS_STRUCTURAL.md` is a manual file and can fall behind the actual UI. _Mitigation_: the change adds a one-line README pointer ("when adding a field, update this file") so the next person sees it. There is no automated check.
- **[No way to revert UX-004 in this branch]** The UX-005 branch is based on `feat/ux-004-quick-actions`. If UX-004 is rejected, UX-005 must be rebased onto `main` (without UX-004). _Mitigation_: documented in the design; rebasing is a known cost, not a hidden one.

## Migration Plan

Single PR on `feat/ux-005-quick-actions-vs-settings` (off `feat/ux-004-quick-actions`):

1. Add the new i18n keys to `en.json` and `pt-BR.json`.
2. Extend the `NodeQuickActions` palette: import `VIBRANT_PRESETS` and `NEUTRAL_PRESETS`, add the section labels, add the "More" toggle.
3. Remove `ColorAccentSection` import and render in `ElementPanel/index.tsx`. Remove any color subsection in `PanelStyleSection.tsx`.
4. Add the color hint row at the top of `BasicFieldsSection` (or in a new tiny section).
5. Add `QUICK_VS_STRUCTURAL.md`.
6. Run `npm run typecheck`, `npm run lint`, `npm run format`, `npm run test`, `npm run build`.
7. Manual smoke: pick a vibrant color, expand "More", pick a neutral, collapse, dismiss with Esc, dismiss with click-outside, undo, multi-select (popover must not appear), edge selection (popover must not appear), open the panel and confirm the hint shows the current color and links to the popover.
8. Open a PR against `main` and request review. Do not merge.

Rollback: revert the single commit. No schema, persistence, or migration concerns. The popover falls back to its UX-004 state (8 colors, no "More") and the panel regains its color section.

## Open Questions

- **Should the popover also offer a "Custom color" entry point that opens a small color picker next to the palette?** A follow-up can add this without changing the popover's shell. Out of scope for UX-005.
- **Should the panel's "Open Quick Actions" button scroll / focus the popover if it is currently off-screen?** Today the popover is anchored to the node and always in view; if that changes in a future zoom/pan UX, the focus call needs to scroll the canvas. Out of scope for UX-005.
- **Should the classification doc live in `docs/architecture/` instead of the panel directory?** Today it lives with the code so it is reviewed in the same PR. If it grows beyond a checklist, the move is a small follow-up.
