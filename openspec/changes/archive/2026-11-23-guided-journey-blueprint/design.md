# Design

## Context

What this change builds on:

- **Diagram data.** `diagram.kindData` already holds guided keys: the lane order and the derived flow id. Lanes are swimlane panel components; the guided model reads them in kind order.
- **Step data.** Per-step data lives in `kindProps` (4 096-character cap), which the experience and phase changes use.
- **The overlay.** `KindOverlay` has a band, separators and a curve, drawn by `KindOverlayLayer`. This change assumes `guided-overlay-fit-export` lands first: framing and read-only drawing then cover the new line for free.
- **Lane commands.** Lane context-menu commands already exist: rename, move up and move down.

## Goals / Non-Goals

**Goals:**

- Both features are optional data that old diagrams simply lack.
- No new element types.

**Non-Goals:**

- Lane shading for backstage lanes. Only the line and its labels are drawn, which keeps lane colours the author's.

## Decisions

### 1. Store the first backstage lane, not a position

`kindData.guidedVisibilityLane = laneId`. A lane id survives reordering: the line follows that lane, and lanes moved above it become frontstage. This matches the blueprint meaning, which is "these lanes are backstage".

- _Alternative considered:_ an index ("after the 2nd lane"). It would silently change meaning when lanes are reordered.
- **Repair.** A dangling id, or the first lane, reads as "no line". Lane removal also clears it in the same edit. The repair runs in `readGuided`, so there is no migration.

### 2. `KindOverlay.lines`

`lines: Array<{ id, across, from, to, labels?: { before: string; after: string } }>`. `across` is the boundary's coordinate across the axis: the top of the first backstage lane on an LR diagram, its left edge on TB. `from` and `to` span the lanes along the axis.

`overlay()` now returns non-null when there is a line, even without phases. In that case the band fields (segments, separators, curve) are empty, and `depth` is 0. `KindOverlayLayer` draws:

- the line as a 1.5 px dashed stroke in `--muted-foreground`;
- the two labels at the start of the line, on each side, small caps.

### 3. Participants as data plus a tag marker

`kindProps.participants: string[]`, merged through the existing `mergedKindProps`.

- **Display.** The checks emit a marker with a `tag: { text, title }`. The host draws it like the badge, through `domAttributes`: `data-kind-tag` and `title`, with CSS `::before` at the bottom-left, so it does not collide with the badge's `::after` at the top-right.
- **The tag is not a check.** It is emitted with `marks: false` and no message in the problem list. `KindMarker` gains `silent: true`, which keeps it out of the problem count.

### 4. A `tags` inspector section

`KindInspectorTags { type: "tags"; values: string[]; suggestions: string[]; add(name); remove(name) }`. The host draws chips, plus the `KindSelectField` built for phases, reused with suggestions as its options and "create" as add.

- _Alternative considered:_ reusing `labels`. It is free text and has no add or remove.

### 5. Outline parsing

- **`---`** is only legal in the leading lane-declaration block, so it cannot clash with steps named "---". A step named `---` must be written `\---`.
- **Prefix splitting.** The lane prefix is split on unescaped `,`: the first part is the lane, and the others are trimmed participants.
- **Serialize.** The prefix is written whenever a step has participants, even when the lane did not change. Otherwise the participants would be lost on read-back.

### 6. Mermaid

- **Journey import** keeps `actors.slice(1)` as participants.
- **Swimlane comments.** `%% participants:` uses `|` between names (commas already separate entries), and `%% visibility:` names the subgraph id (`lane2`). Both are read back by id, like `%% phases:`.

## Risks / Trade-offs

- **[Risk]** BREAKING: an existing outline with a comma in a lane prefix now gets participants. → Lane names with commas are rare. Serialize escapes them, so copied outlines round-trip. This is called out in the proposal and the docs.
- **[Risk]** The tag and the badge compete for space on small steps. → The tag sits at the bottom-left and the badge at the top-right. The tag truncates at 18 characters, and the full list is in the tooltip.
- **[Risk]** The line's labels overlap the lane headers on LR. → The labels are offset past the lane header width, which the layout already reserves.

## As implemented

- **No `silent` flag.** Only the mode bar's focus chip reads markers, and it reads them by code, so a participants tag (a marker with `marks: false`) is never counted anywhere. The flag was dropped.
- **The visibility action has an icon.** Lane actions show in the lane's floating bar only when they carry a glyph, so "Line of visibility above this lane" uses an eye, and the remove action uses a crossed eye. The context menu still lists both.
- **The overlay cache includes `kindData`.** The line lives in `kindData`, not in the snapshot, so `kindOverlayFor` now also checks `kindData` when it reuses a cached result. Before, setting the line did not redraw it.
- **Kind data can name a node added in the same edit.** A top-level `kindData` string that equals a node key from the same edit becomes that node's id. That way an outline can declare a new lane and put the line above it in one edit.
- **Text sync** (`guided-journey-live-text`) reconciles participants and the line as two more change kinds, `participants` and `visibility`.
