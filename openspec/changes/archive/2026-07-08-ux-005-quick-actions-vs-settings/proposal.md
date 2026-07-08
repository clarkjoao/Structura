## Why

The Node Quick Actions popover introduced in UX-004 exposes a fixed 8-color palette and a Reset action next to a single selected node. It establishes the right **mechanism** — quick visual edits anchored to the canvas — but only ships a fraction of the **policy** that UX-005 calls for: which edits count as "quick" (canvas), which count as "structural" (right-side panel), and how the two surfaces stay in sync. Today the ElementPanel still owns all node fields, including the ones the popover now duplicates (color), and it surfaces them in a flat order that doesn't separate "I'll change this ten times a session" from "I'll change this once a quarter".

Without the policy half of UX-005, the popover reads as a one-off, and users who discover the panel have no signal that color (and the small handful of other visual fields that should follow) is intentionally not the panel's job. With the policy in place, the popover becomes the natural home for a small, well-known set of visual tweaks, and the panel can stop carrying their weight.

## What Changes

- **Expand the Quick Actions palette** to the full `PANEL_PRESETS` list (15 vibrant + 6 neutral swatches, grouped under small section labels). The popover grows in width but stays compact: 2 rows of 11 swatches, with the Reset button still in the top-right. A collapsible "show neutrals" affordance hides the neutrals row behind a "More" toggle by default to keep the at-rest popover the same size as today.
- **Move the "Color" section out of the ElementPanel**. `ColorAccentSection` (and the color subsection of `PanelStyleSection` if any) is removed from the panel's render and replaced by a small "Edit in Quick Actions" hint that points the user to the popover for color. All other sections stay.
- **Document the quick vs structural classification** in a small constant so the next time someone adds a field they know which bucket it belongs in:
  - **Quick** (popover, future additions may include this set): node color, panel border color, note color (light/dark).
  - **Structural** (panel): name, description, technology, tags, type, parent, shape (for flow/process), locked, swimlane, border style, external links, position.
- **Update the NodeContextMenu to mention the popover** only if the user is hovering a node whose popover is hidden (e.g. compare mode). The change is a single subtitle line; no behavior change.
- **No changes to the store**, to the canvas event handlers, to the persistence schema, or to the i18n keys for existing strings. One new i18n key per locale for the "More" toggle label and the "Edit in Quick Actions" hint.
- **Coexistence rule**: the popover and the panel's color hint MUST stay in sync — picking a color in the popover updates the hint to "current: <color name>"; opening the panel does not show the color picker. The hint is a one-line read-only indicator, not a duplicate control.

## Capabilities

### New Capabilities

_None._ The Quick Actions surface already exists (spec `node-quick-actions`); this change extends and clarifies it.

### Modified Capabilities

- `node-quick-actions`: Extend the existing spec with the larger palette, the "More" toggle, the section labels (Vibrant / Neutral), and the "no color picker in the panel anymore" invariant.
- `element-panel-scope`: New spec that records the policy: which fields the ElementPanel owns (structural) and which it explicitly does not (color, border color). Future field additions check this spec before deciding where the field lives.

## Impact

- **Modified source files**
  - `src/features/canvas/panels/NodeQuickActions.tsx` — swap the 8-color constant for the full `PANEL_PRESETS` group, add the "More" toggle state, and add the section labels. Total height grows from ~28px to ~56px when expanded; collapsed stays at ~28px.
  - `src/features/canvas/panels/ElementPanel/index.tsx` — drop the `ColorAccentSection` import + render. Add a one-line "Color" hint at the top of the panel that reads the current color from the selected node and links the user back to the popover (the link is a small "Open Quick Actions" button that focuses the popover).
  - `src/features/canvas/panels/ElementPanel/sections/index.ts` (or equivalent) — remove the `ColorAccentSection` export.
  - `src/features/canvas/panels/ElementPanel/sections/PanelStyleSection.tsx` (if it has a color subsection) — drop the color subsection.
  - `src/infrastructure/i18n/locales/en.json` and `pt-BR.json` — new keys: `nodeQuickActions.sectionVibrant`, `nodeQuickActions.sectionNeutral`, `nodeQuickActions.moreToggle`, `elementPanel.colorHintLabel`, `elementPanel.openQuickActions`.
- **New source files**
  - `src/features/canvas/panels/ElementPanel/QUICK_VS_STRUCTURAL.md` — short markdown recording the classification, owned by the same team that owns the panel. Not a long doc; just a checklist for the next field add.
- **Store surface** — unchanged. Both the popover and the (no-longer-present) color section in the panel went through `updateComponent`, and the panel hint only reads.
- **i18n** — 5 new keys per locale.
- **Persistence** — none.
- **Risk** — medium. The panel-side hint is new and the user might be confused if the hint says "Color: blue" but they expected to edit it. _Mitigation_: the hint label is "Edit in Quick Actions" (a verb), and the popover is the only edit path; the hint is read-only.
- **Out of scope (Non-Goals)**
  - Quick actions for **edge direction / edge style**. Still a follow-up; the popover only fires on single-node selection today and adding edge support means reworking the gating and the data plumbing.
  - Adding the popover to multi-selection. Still a follow-up.
  - Free-form color picker. Still a follow-up.
  - Reorganizing the rest of the ElementPanel. Only the color section is touched.
  - Touch / stylus specific gestures.
  - New store actions.
  - New dependencies.
