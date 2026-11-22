## Why

Teams already describe journeys and processes in Mermaid: in READMEs, ADRs, wikis, and in what LLMs produce when asked for a flow. Two Mermaid diagram types map almost directly onto the guided journey:

- **`swimlane-beta`** (Mermaid 11.16+, beta): top-level `subgraph`s are lanes, nodes use flowchart shapes, `{}` is a decision and `-->|Yes|` is a labelled exit. This is the guided model.
- **`journey`**: `section`s (phases), tasks with a 1–5 experience score, and actors per task.

Today none of that can come in or go out: the author retypes it.

This is part 1 of 3 of the Mermaid track the user asked for:

1. Interchange (this change).
2. An experience score and pain points per step.
3. Phases as bands along the reading axis.

Part 1 makes the text capture speak Mermaid, so parts 2 and 3 only add what the data model lacks.

## What Changes

- **Import (paste and panel).** The guided text capture recognises a Mermaid block and builds the journey from it, through the same anchor, lanes, layout and single-undo path as the outline. The block may be fenced in ` ```mermaid `. It is recognised in three places:
  - a canvas paste;
  - the "Text" panel;
  - the assistant's `add_journey_outline` tool.

  Supported headers:
  - **`swimlane-beta`, `flowchart` and `graph`** (any direction): top-level `subgraph`s become lanes. Nodes keep their shape where the journey has one (decision, data, subprocess, start/end circles) and become steps otherwise. Edges become connections, labels included: `-->|x|`, `-- x -->`, chains `A --> B --> C`, and `&` groups.
  - **`journey`**: each task becomes a step in the lane of its first actor, in the order written. Sections and scores are read but not kept yet (parts 2 and 3), and the summary says how many were set aside.
  - Styling and metadata are ignored without error: `classDef`, `class`, `style`, `linkStyle`, `click`, `accTitle`, `accDescr`, `title`, `%%` comments, front matter.

- **Export.** "Copy as text" becomes a small menu with three formats:
  - **Outline**, as today.
  - **Mermaid swimlane**: everything, with lanes, shapes, decisions and labels.
  - **Mermaid journey**: the main path only, one section, actors from the lanes, and a neutral score of 3 until part 2. A comment notes what was left out.
- **Errors are Mermaid-aware.** A line the reader cannot place is reported per line, as the outline does: an unknown header, an unclosed `subgraph`, an edge to a node with no label, or a node outside any lane when there are no lanes.
- **The assistant** is told it may answer with a Mermaid `swimlane-beta` block in the same tool.

## Capabilities

### New Capabilities

- `guided-mermaid-interchange`: reading and writing a guided journey as Mermaid (`swimlane-beta`/`flowchart`/`graph` and `journey`).

### Modified Capabilities

None. `guided-journey-outline` is still pending archive in `guided-journey-text-capture`. This change reuses its anchor and build rules without changing them.

## Non-Goals

- **Keeping the score, actors beyond the first, and sections:** these come in parts 2 and 3.
- **A live Mermaid editor or preview.**
- **Mermaid types other than these three headers**, for example sequence or state diagrams.
- **Round-tripping Mermaid styling** (`classDef` colours).

## Impact

- **New:** `guided.mermaid.parse.ts` (Mermaid → the outline AST), `guided.mermaid.serialize.ts` (swimlane and journey) and their tests.
- **Changed:**
  - `guided.outline.parse.ts`: an optional shape on nodes, and jumps by reference as well as by name.
  - `guided.outline.build.ts`: resolves jumps by reference.
  - `guided.outline.ts`: detects the header and dispatches.
- **Kind contract:** `KindTextCapture` gains `formats?: { id, label, serialize }[]`.
- **UI:** `KindTextPanel.tsx` (the copy menu, a syntax hint that mentions Mermaid).
- **LLM:** `prompt-builder.ts` (one paragraph).
- **Locales:** en and pt-BR.
- **Docs:** `docs/concepts/diagram-kinds.md`.
