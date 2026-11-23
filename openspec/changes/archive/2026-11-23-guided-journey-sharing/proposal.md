# Proposal

## Why

Three things are hard today:

- **Sharing with someone who won't open the canvas.** A journey reaches them only as a picture, and the app has no image export yet; that is planned as a separate, fuller feature.
- **Presenting.** A walkthrough has to be assembled by hand, even though the phases already say where each act of the story starts.
- **Starting and reviewing.** A new guided diagram opens with a single start step. Asking the assistant for a critique means writing the prompt from scratch.

## What Changes

- **Journey as a document.**
  - "Copy as… Document (Markdown)" in the Text panel writes the journey as Markdown, with one section per phase in reading order. Each step is listed with its lane and participants. Decisions are listed with their labelled exits, including loops back.
  - The same document can be downloaded as a `.md` file.
- **Present by phase.**
  - "Present by phase" in the guided mode bar creates or updates a walkthrough with one scene per phase.
  - Each scene plays a flow that follows that phase's steps. These per-phase flows are derived, like the journey's own flow, and kept in sync.
- **Review the journey.**
  - A "Review journey" menu in the guided mode bar sends the assistant a preset request, which comes back as a reviewable revision:
    - missing error paths;
    - handoffs between lanes without an owner;
    - decisions without a negative exit;
    - wording in the customer's language.
- **Start from a template.** Creating a guided diagram offers:
  - Blank;
  - three templates (Checkout, Onboarding, Support ticket);
  - "Paste meeting notes", which opens the assistant with the notes and a request to build the journey.

## Non-Goals

- PNG or SVG export. A fuller export feature will come separately.
- Editing the document and applying it back. The Text panel is where text edits live.
- User-defined templates.
- Presenting anything other than guided journeys by phase.

## Capabilities

### New Capabilities

- `guided-journey-sharing`: covers the Markdown document, presenting by phase, the review presets, and the creation templates.

### Modified Capabilities

None.

## Impact

- **Guided kind:**
  - `guided.document.ts` (the Markdown writer, added as a `KindTextFormat`);
  - `guided.derive.ts` (per-phase flows, keyed in `kindData`);
  - templates as outlines built through `buildOutline`.
- **Canvas:** the `KindModeBar` actions for "Present by phase" and "Review journey".
- **Walkthroughs:** `src/features/walkthrough`, to create or update a presentation from a diagram's phase flows.
- **Assistant:** `src/features/llm`, to send a preset request.
- **Creation dialog:** `src/pages/dashboard/AddDiagramDialog.tsx`, with the template choice for kinds that offer templates (`DiagramKindDescriptor.templates?`).
- **Other:** en and pt-BR keys and the docs.
