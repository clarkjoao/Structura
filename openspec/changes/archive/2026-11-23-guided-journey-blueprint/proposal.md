# Proposal

## Why

Two things that real journey and service-blueprint work needs are missing.

- **The line of visibility.** Lanes are a flat list, so a guided journey cannot show which part of the service the customer sees and which happens backstage. Service blueprints draw exactly that line, and it is the first thing a team looks at in a blueprint review.
- **More than one actor per step.** A step can only have one actor, its lane. Mermaid's `journey` allows several actors per task (`Do work: 1: Me, Cat`), and today every actor after the first is dropped on import. Real steps are often shared ("Cliente e atendente revisam o pedido").

## What Changes

- **Line of visibility.**
  - A guided journey MAY have one line of visibility, set above a lane. Lanes above it are _frontstage_ and lanes from it down are _backstage_.
  - The canvas draws the line across all columns, labelled "Visible to the customer" above it and "Backstage" below, as part of the kind overlay. It is not an element.
  - It is set or removed from a lane's context menu ("Line of visibility above this lane").
- **Participants.**
  - A step MAY have participants: names besides its lane's actor, stored as `kindProps.participants`.
  - The Journey tab gets a "Participants" field: chips, plus a select that suggests the other lanes and accepts a new name.
  - The canvas shows them as a small "+ Atendente" tag on the step.
- **Text.**
  - **Outline lanes.** In the lane declarations at the top of an outline, a line `---` puts the line of visibility before the next lane.
  - **Outline participants.** A step's lane prefix may list participants after the lane, `Cliente, Atendente: Revisa pedido`. **BREAKING (minor):** a comma in a lane prefix now separates participants; a lane name with a comma is written `\,`.
  - **Mermaid `journey`.** All actors are read: the first is the lane and the others are participants. The export writes them back.
  - **Mermaid swimlane.** The export keeps participants in `%% participants:` and the line in `%% visibility:`, and reads both back.
- **Assistant.** The guided prompt documents `---` and participants.

## Non-Goals

- More blueprint lines (line of interaction, line of internal interaction). The data allows adding them later.
- Making participants lanes of their own, or drawing a step across several lanes.
- Physical-evidence rows, or touchpoints as a separate row.
- Checks that enforce frontstage or backstage rules.

## Capabilities

### New Capabilities

- `guided-journey-blueprint`: the line of visibility (data, drawing, how it is set) and step participants (data, the Journey tab field, the canvas tag).

### Modified Capabilities

- `guided-journey-outline`: the format gains the `---` lane separator and participants in the lane prefix.
- `guided-mermaid-interchange`: journey import keeps every actor, and both exports carry participants and the line. This requirement text is also brought up to date: it still says scores and sections are "set aside", which the experience and phases changes already replaced.

## Impact

- **`src/features/diagram-kinds/guided`:**
  - model: `visibilityLaneOf`, `participantsOf`;
  - edits: set the line, set participants;
  - overlay: a new `lines` entry;
  - the outline parse, build and serialize;
  - the Mermaid parse and serialize;
  - checks: badge-like participants tag;
  - inspector: a new section;
  - the lane context-menu command.
- **`src/features/diagram-kinds/kind.types.ts`:**
  - `KindOverlay.lines`;
  - a `KindInspectorTags` section type;
  - `KindMarker.tag` for the participants tag.
- **`src/features/canvas`:**
  - `KindOverlayLayer` draws lines;
  - `KindInspectorTab` draws the tags section;
  - node overlay CSS for the tag.
- **Data:** `kindData` key `guidedVisibilityLane` (the lane id) and `kindProps.participants: string[]`. Both are optional; old diagrams are unchanged.
- **i18n:** en and pt-BR.
