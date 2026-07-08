# Quick vs Structural fields

This file records the classification of every editable field on a `Component`, so a new field lands in the right surface (Quick Actions popover or ElementPanel) and the two surfaces stay in sync.

When adding a field, update this list **before** opening the PR.

## Quick (Quick Actions popover, anchored to the selected node)

- `nodeColor` — for `FlowNodeComponent` and `ProcessNodeComponent`.
- `panelColor` — for `C4Component` and `PanelComponent` (light theme) and `NoteComponent` (light theme).
- `panelColorDark` — for `NoteComponent` (dark theme).

Rule of thumb: a field is "quick" if (a) it is one click to change, (b) it is changed often (tens of times per session), and (c) the wrong value is low-risk (visually obvious, easily undone).

## Structural (ElementPanel, on the right side of the canvas)

- `name` — display label.
- `description` — long-form text.
- `technology` — tech stack label.
- `tags` — classification.
- `type` — C4 level / component type.
- `parentId` — hierarchy.
- `flowShape` / `shape` — process and flow node shapes.
- `locked` — element lock state.
- `swimlane` / `borderStyle` — visual properties that are not quick because they are rarely changed.
- `externalLinks` — list of external links.
- `position`, `width`, `height` — explicit Position section, edited via numeric inputs.
- `serviceId` — service catalog link.
- `linkedDiagramId` — drill-down link to another diagram.

Rule of thumb: a field is "structural" if changing it requires more than one click, if it is changed rarely, or if the wrong value could break the model (name, type, parent).

## Why this split

The Quick Actions popover appears next to the selected node on the canvas, so the user reaches it without moving the mouse. The ElementPanel is on the right edge of the screen, so it is good for fields that require reading, writing, or scrolling. Putting color in the popover matches the "color is the most-changed visual property" usage pattern; putting name and description in the panel matches their need for focus and edit time.
