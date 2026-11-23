# Diagram kinds

A **diagram kind** guides the construction of one kind of diagram. The first one is **guided**:
a journey or data-flow map in lanes, BPMN-inspired, written step by step from the keyboard. The
decision and its rationale are in [ADR-0014](../adr/0014-diagram-kinds.md); this page describes
the code as it stands.

## A kind is metadata, not a format

```ts
interface Diagram {
  kind?: string;          // "guided" | "<pluginId>:<kind-id>"
  kindMode?: "freehand";  // absent = the kind's own editor
  kindData?: JsonObject;  // the kind's, opaque to everything else (≤ 64 KB)
}
```

- A kind diagram's content is only elements, connections and flows a freehand diagram can hold.
  The viewer, every exporter and persistence work without the kind registered.
- `sanitizeKindFields` (`features/diagram/model/diagram-kind.ts`) runs on every way in: JSON
  import and folder files (`normalizeImportedDiagram`), share links, and collaboration docs. It
  **keeps** a well-formed kind nothing registers (a missing plugin must not destroy data) and
  drops a malformed one.
- The collaboration relays (Node and Go) declare `kind`, `kindMode` and `kindData` as doc
  fields. An older relay does not carry them, so its peers see the diagram freehand, and the
  host's kind is left untouched.
- Undo checkpoints carry `kindMode` and `kindData`, so a mode switch is one undo step.

## The contract

`features/diagram-kinds/kind.types.ts` defines `DiagramKindDescriptor`. It is registered through
`registerDiagramKind` (`registry.ts`), which validates the id, refuses duplicates and requires
`conforms`. Built-ins register from `bootstrap.ts` (`registerBuiltInDiagramKinds`, called by the
app and embed-editor entries). With nothing registered, the editor is exactly the freehand one.

| Field | What it decides |
| --- | --- |
| `elements` | the palette, quick insert and bottom toolbar in kind mode (any registered type, plugin types included); `label` renames an element there, `primary` makes it a toolbar button (the rest go under "More") |
| `interaction` | drag, resize, the Arrange menu's Manual/Automatic choice, recording flows |
| `create` | a new diagram's template |
| `conforms` (required) | whether a diagram edited freehand can come back; issues name their element |
| `derive` | derived content after every edit (guided: its flow) |
| `derivedFlowIds` | which flows `derive` owns (shown as derived, not removable) |
| `arrange`, `arrangeKey` | the arrangement, and what beyond structure triggers it (guided: lane order) |
| `checks` | quiet markers (a class on the node or edge, never a dialog) |
| `commands` | keyboard chords and context-menu entries |
| `elementActions` | per-element actions in the context menu and the canvas's floating bar |
| `insert` | where a palette element goes in kind mode |
| `textCapture` | writing the diagram as text: `build` (text → edit), `serialize`, `syntax`; optionally `writeBase` (the whole diagram, with each line's element, handles and the connections it writes) and `reconcile` (an edited whole text → the difference as a `KindEdit` plus a per-change list), which turn the Text panel into a whole-diagram editor |
| `overlay` | what the kind draws over the canvas in kind mode, in flow coordinates: a header band with segments, separators across the lanes, and lines between lanes (guided: phases and the line of visibility); never an element |
| `inspector` | the kind's own inspector tab (e.g. guided "Journey"): `tab`, `hiddenFields` (Details fields hidden in kind mode), `sections(ctx, id)` as data — choice groups, select-or-create fields (`select`) and label fields whose `run`/`commit` return a kind outcome; `null` means no tab for that element |

A kind reads the world only through `KindContext` (`context.ts`), which provides `t`, the element
registry lookup, direction, layout settings and id minting. It returns `KindEdit` change sets
(`features/diagram/model/kind-edit.types.ts`): the plugin `applyChanges` vocabulary plus
re-parenting, re-wiring, relabelling, lane orientation, flows and kind data. The store applies
them Version-aware (`kind.slice.ts`, `applyKindEditInDraft`). The order of operations is: add,
re-parent, remove, then the rest, so removing a lane never takes the steps just moved out of it.

## Policy: ask the resolver, never `diagram.kind`

`resolveKindPolicy(diagram)` (`policy.ts`) is the only reader:

| Diagram | Policy | Editor |
| --- | --- | --- |
| no kind | `freehand` | today's |
| kind registered, no `kindMode` | `kind` | the kind's (palette, commands, arrangement, checks) |
| kind registered, `kindMode: "freehand"` | `kind-freehand` | freehand, with "Back to <kind>" |
| kind not registered | `kind-unavailable` | freehand, with a notice; the kind is kept |

`kind-reads.guard.test.ts` fails the suite if a file outside the allowed list reads `.kindMode` or
`diagram.kind`.

## One watcher for every writer

ELK and measurement are asynchronous, so a kind cannot run inside the edit's `set()`. The
`watchDiagramKind` watcher (`canvas/hooks/kindWatcher.ts`, mounted by `useDiagramKindWatcher`)
follows the automatic arrange mode's watcher:

- It watches the active diagram in kind mode. Any content change schedules `derive`, and a change
  to the structure or `arrangeKey` also schedules `arrange`, about 50 ms later.
- Undo/redo and a peer's change only rebaseline.
- It writes without history (`applyKindEdit(…, { history: false })` and `applyAutoLayout(…,
  { history: false })`). The edit's own checkpoint already holds the old structure, flow and
  positions, so one undo reverts all three.
- After a run it stores `kindData.arrangedSignature`. Opening a diagram whose structure changed
  while it was closed (a plugin writing another `diagramId`, an older build, freehand mode)
  arranges it once.

Because it watches the store, it covers the UI, plugin `applyChanges`, assistant patches, pastes
and Version edits alike. The deliberate Arrange (button, shortcut, density, direction) runs the
kind's arrangement as one undo step (`useAutoLayout`).

## Compatibility with plugins

- `getDiagram` snapshots carry `kind`, `kindMode` (`"kind"` or `"freehand"`) and
  `kindAvailable`. A freehand snapshot is unchanged.
- `moveComponents` on a diagram in kind mode moves nothing and returns
  `{ refused: "kind_controls_layout" }`. `applyChanges` applies the structure, skips the moves
  and reports `movesRefused`; the kind then arranges what was added.
- `PanelContribution.appliesTo.kinds` scopes a panel to kinds (`"freehand"` = no kind). An
  invalid scope is dropped with a warning.
- `createDiagram` makes freehand diagrams.
- API `1.16.0`. `registerDiagramKind` is not exposed to plugins yet.

## The guided kind

`features/diagram-kinds/guided/`:

- **Reading** (`guided.model.ts`). Lanes are top-level swimlane panels, in the order
  `kindData.laneOrder` stores. Only the lane actions change it, so no arrangement, Arrange run
  (ELK, while freehand), drag or peer move reorders lanes. A lane the order does not name yet
  takes its place by position, and a diagram with no stored order reads its lanes by position.
  Steps are the journey flowchart shapes (task, start, end, event, decision, subprocess, data
  store, document) inside a lane. The sequence is the connections between steps. `kindData` holds
  `flowId`, `laneOrder` and `arrangedSignature`.
- **Derived flow** (`guided.derive.ts`). It reads like a recording: a step at each journey step
  and, between two of them, a step on the connection travelled, so playback lights the lines.
  Each lane's header orientation follows the diagram's direction.
- **Gestures** (`guided.edits.ts`, bound as commands):
  - `Tab` adds the next step: an append, an insert between, or a decision's new exit.
  - `Shift+Tab` adds a branch, inserting a decision first when the step is not one.
  - `Alt+↑/↓` (or `←/→`) moves the step to the lane above or below.
  - `Delete` sews the gap with the deleted exit's label; the only start step stays.
  - Each gesture places the new step provisionally, so it shows in place before the arrangement
    refines it.
- **Arrangement** (`guided.arrange.ts`). Longest-path layers become columns, with back-edges
  (retries) left out. Lanes are bands as deep as their tallest column stack. The arrangement is
  written along/across and mirrored for top to bottom. It is synchronous and stable: appending a
  step moves nothing, and inserting one moves only the steps after it.
- **Derived flow** (`guided.derive.ts`). A depth-first walk from the start builds it, and a
  decision (or any step with several exits) becomes a condition. Retries stay out (flows have no
  cycles), and steps the start cannot reach are not in the flow. Content written on a flow step
  survives by the step it points at.
- **Checks** (`guided.checks.ts`): a decision exit without a label, and a step that ends a path
  without being an end step.

## Writing a journey as text

The guided kind's `textCapture` (`guided.outline.*.ts`, spec `guided-journey-outline`) reads an
outline, one line per step:

```text
Cliente: Escolhe produto        # a step in a lane; a line without "Lane:" keeps the lane
App: Gera cobrança Pix
? Pagou                         # a decision; its exits indented under it
  sim -> API: Confirma          # label -> step | ? decision | ! end | @jump
  não -> @Escolhe produto       # a jump to a step written before (closes the path)
App: Emite nota                 # reached from every branch still open
! Concluído                     # an end step (closes the path)
```

- **Lanes.** `Lane:` alone declares a lane. Lane names match trimmed and case-insensitively, and a
  missing lane is created after the others. `-> Step` (no label) is an exit without a label.
- **Escaping.** `\` makes the next character literal: write `Status\: pago` for a colon in a
  name. The markers are the same in every language.
- **Where it goes.** After the selected step, like Tab (inserted before its next step), or as a
  decision's new exit. With nothing selected, at the end of the main path (each decision's first
  exit), before its end step. An end step selected is refused.
- **One edit.** The whole outline is one `KindEdit`, so one undo removes it. Errors are per line,
  and any error applies nothing.
- **Three ways in.** The "Text" button in the kind bar opens the panel: it checks as you type,
  `Ctrl/Cmd+Enter` applies, and "Copy as text" serializes the journey. A canvas paste of plain
  text that reads without errors and has two or more steps is added the same way, with an Undo
  notice. Markup and JSON (a canvas copy writes drawio XML) are never read as an outline. The
  assistant gets the format, the current journey and the `add_journey_outline` tool on guided
  diagrams only, and an outline with errors is dropped and its errors are told back.
- **Serializing.** Lanes are declared first, then the journey from the start. Every step reached
  again (a convergence or a retry) is written as a jump, so the text reproduces the same
  connections. Unreachable steps are left out with a comment.

### The whole journey as text

The Text panel (spec `guided-journey-text-sync`, `guided.outline.reconcile.ts`) opens on the whole
journey. The edited text is reconciled against the text the panel wrote:

- **Identity.** Each written line knows its step (`writeGuidedOutline` → `lineIds`). Edited lines
  are aligned to them by a line diff (`guided.outline.align.ts`): kept lines keep their step, a
  line edited in place (a rename) is paired with the one it replaced, and a line
  moved unchanged is found again. A trailing handle, `Paga {#s4}` ("Copy as… Text with ids"),
  overrides the alignment; an unknown or repeated handle is a line error. Handles are ignored when
  an outline is only added.
- **The difference.** Renames, step kinds, lanes, phases, participants, steps added and removed, and the
  connections the text writes (connected, disconnected, relabelled) become one `KindEdit`, one
  undo step. Each change also carries its own part of the edit (`KindTextChange`), for the
  "Review" list. Steps the text does not write (unreachable ones, the start), a non-decision
  step's extra exits, lanes, notes and texts are never touched; lanes are only added.
- **Canvas and text.** Untouched, the text follows the canvas. Edited, it is kept when the canvas
  changes, with a "Reload from the diagram" notice; applying then skips the changes whose step no
  longer exists and says how many. "Insert at the selection" keeps the add-only panel.

### Editing in place

Spec `guided-direct-editing`. In kind mode, on an editable canvas:

- **Phases on the band.** A double click on a segment renames the phase (`segments[].rename`). An empty name removes it. Dragging a separator moves the next phase's start to the step at the drop column (`separators[].moves`, candidates between the neighbouring starts), with a snapped preview.
- **Step names.** `nameCommit` reads a name typed in the inspector title with the outline's shortcuts: `? ` makes a decision, `! ` an end (refused with exits), and `Lane: ` moves the step to that lane when the lane exists. Otherwise the text stays the name, so "Meeting: kickoff" is kept. Escapes keep the characters.
- **Lane headers.** A double click on a lane's header renames it in place (`LaneRenameContext`, provided only by the editor canvas in kind mode).

### The text as a workspace

Spec `guided-text-workspace`.

- **Docking.** The Text panel can be docked: it becomes a persistent panel under the mode bar, resizable from 280 to 640 px, and remembered per browser (`textDock`, `textDockWidth`).
- **Caret and selection.** The journey field (`KindJourneyEditor`) has a gutter with line numbers and error markers. The caret's line selects its step on the canvas and frames it (debounced). The selected step's line is highlighted and scrolled to. An edited draft is mapped to steps through `alignLines`.
- **Completions.** `KindTextCapture.suggest(diagram, linePrefix)` offers lanes at a line's start, steps after `@`, and phases after `##`. Tab or Enter completes, Esc closes.

### Sharing, presenting, reviewing and starting

Spec `guided-journey-sharing`.

- **Document.** The "Document (Markdown)" format (`guided.document.ts`) writes one section per phase in reading order. Each step is listed with its lane and participants, each decision with its exits, and ways back as "back to …". A format with `download` is also offered as a file in "Copy as…".
- **Present by phase.** Derivation keeps one flow per phase (`kindData.phaseFlowIds`, listed as derived and read-only), entered at the phase's start and ending where an exit leaves the phase. The kind's `presentation(diagram)` gives the scenes. The mode bar's "Present by phase" upserts the walkthrough marked `source: { diagramId, kind: "phases" }`, keeping scene notes, and opens the player.
- **Review journey.** `reviewPresets` are translated requests. Picking one queues it (`useLLMStore.queuePrompt`), the canvas opens the assistant, and the chat panel sends it with the diagram's context. The answer comes back as a reviewable revision.
- **Templates.** `templates` are translated outlines built after the blank start when the diagram is created. `tidyTemplate` then drops the blank lanes the template left empty. "Paste meeting notes" queues a request to build the journey from the notes, and the assistant opens with the new diagram.

### Vertical journeys

Spec `guided-vertical-journeys`. A guided journey reads left to right (lanes as rows) or top to bottom (lanes as columns). Every guided feature follows `diagram.direction`: the arrangement, the lanes' orientation, the phase band (left of the lanes when vertical), the line of visibility, tags, text and exports.

- **Creating.** The creation dialog offers the direction when the kind sets `directionChoice`. `createKindDiagram({ direction })` sets it before the template, so the lanes are made in that orientation.
- **Switching.** The guided mode bar has a →/↓ toggle that runs the same switch as Arrange → Direction (`useCanvasArrangeControl`). It is one undo step and is locked for the same reasons.
- **From Mermaid.** A `flowchart TD`/`swimlane-beta LR` header gives the parsed outline a `direction`. `buildOutline` applies it, as `KindEdit.direction` plus `laneOrientation`, only to a journey that is still just its start step. An existing journey keeps its own.

### The assistant revises a journey

Spec `guided-assistant-revisions`. On a guided diagram in kind mode, the assistant sees the journey written with handles (`{#s1}`…) and gets two tools: `add_journey_outline` to add, and `revise_journey` to propose the whole journey edited.

- **Read against what it saw.** The handle map is kept for the turn (`currentJourneyBase`). A revision is reconciled with the same engine as the Text panel. An outline with errors, an unknown handle, or a revision that changes nothing is dropped, and the reason is told back.
- **Reviewed change by change.** The suggestion card groups the changes by phase, in reading order, with one checkbox per dependency group. A group holds:
  - steps added together;
  - a removal with the connection that sews its neighbours and the phase it hands on.

  A `# why:` line above a step shows as the change's reason. "Apply n changes" applies the ticked groups as one undo step (`editForChanges`).
- **Preview and staleness.** The canvas outlines the steps the ticked changes touch, and marks removals in red. These previews have no Keep/Discard bar. When the diagram changes, the card reads the revision again: a change whose step is gone shows as no longer applicable and cannot be ticked.

### Blueprint: the line of visibility and participants

Spec `guided-journey-blueprint`.

- **The line of visibility.** `kindData.visibilityLane` holds the first backstage lane's id: lanes before it are what the customer sees, the rest are backstage. It is set and removed from a lane's menu ("Line of visibility above this lane"), follows the lane when lanes are reordered, and goes when that lane is removed. A dangling id, or the first lane, reads as no line. The overlay draws it as a labelled dashed line across every column (`KindOverlay.lines`), in kind mode, on read-only surfaces and in the draw.io decoration layer.
- **Participants.** `kindProps.participants` lists who acts with the step's lane: trimmed, distinct, at most 8 names of 60 characters, never the lane itself. The Journey tab's "Participants" field (a `tags` inspector section) adds them from the other lanes or as new names; the canvas shows a "+ Name +n" tag at the step's foot (`KindMarker.tag`, `data-kind-tag`), with the full list as its tooltip. A tag is not a check.
- **In text.** `---` between the lane declarations at the top puts the line before the next lane. A step's prefix lists participants after its lane: `Cliente, Atendente: Revisa pedido`. **A comma in a lane prefix now separates participants**: a lane name with a comma is written `\,`. Mermaid `journey` keeps every actor (the first is the lane, the others participants), and the swimlane export writes `%% participants: s4=Ana|Bia` and `%% visibility: lane2`, read back on import. A text edit (the whole-journey panel) reconciles both.

### Mermaid in and out

The same capture reads Mermaid (`guided.mermaid.*.ts`, spec `guided-mermaid-interchange`). A text whose first meaningful line is `swimlane-beta`, `flowchart`, `graph` or `journey` is read as Mermaid. The first meaningful line skips any ` ```mermaid ` fence, front matter and `%%` comments. Everything else is read as an outline.

- **Swimlane / flowchart.**
  - **Lanes.** Each top-level `subgraph` becomes a lane. Nested subgraphs add their nodes to the enclosing lane.
  - **Shapes.** `{}` becomes a decision, and so does any plain node where the path splits. `[()]` is data, `[[]]` a subprocess, and `@{ shape: doc | event }` a document or an event. A circle or stadium with no incoming edge stands for the start and is not added; its edges leave from the anchor instead. A circle or stadium with no outgoing edge is an end.
  - **Edges.** `-->|x|`, `-- x -->`, chains and `&` groups all become connections.
  - **How it is read.** The graph is turned into the outline AST by a depth-first walk. A node reached again becomes a jump by Mermaid id, and several entries become a fan-out from the anchor. So `buildOutline` adds Mermaid exactly as it adds an outline: after the selection, as one undo step.
- **Journey.** Tasks are added in order, each in the lane of its first actor. Sections become phases; scores are checked (Mermaid requires them) but not kept.
- **Ignored lines.** Styling and metadata (`classDef`, `class`, `style`, `linkStyle`, `click`, `acc*`, `title`, `direction`) are ignored. Any other line that cannot be read is an error on that line.
- **Copy as.** The Text panel's menu offers Text (the outline), Mermaid (lanes) and Mermaid (journey):
  - Mermaid (lanes) writes `swimlane-beta`, which reads back into the same journey.
  - Mermaid (journey) writes the main path (each decision's first exit in reading order) with every task scored 3 (Mermaid requires a score; Structura keeps none), and a comment on what was left out.

### Element kind data

`Component.kindProps` is data the diagram's kind owns on one element: JSON, at most 4 096 characters, dropped on import when malformed. It is kept in freehand mode, and it is copied, versioned and removed with the element. A kind edit sets it with `add[].kindProps` and replaces or clears it with `update[].kindProps` (`null` clears it).

Guided stores a step's **phase start** (`phase`) and its **participants** (`participants`) there. An `experience` value left by the removed experience score is ignored.

### Phases

A guided step may **start a phase** (`kindProps.phase`, spec `guided-journey-phases`). The phase runs through the following steps until the next start. Where branches converge, a step takes the latest phase among its forward predecessors. Retries carry no phase back. The starts are the phase list: there is nothing else to keep in sync.

- **Arrangement.** The arrangement gives each phase contiguous columns after every column of the phases before it. It does this with floors in the longest-path layering, relaxed until stable. Phase starts are part of `arrangeKey`.
- **The band.** The overlay draws a header band beside the lanes, above them or left of them on top-to-bottom diagrams. It has one segment per phase (a click selects the phase's start) and dashed separators across the lanes. Nothing moves to make room, and freehand mode hides the band.
- **Framing, viewer, draw.io.** The band takes no layout room, so whole-diagram framing adds it explicitly: Fit view, the opening viewport, the framing after Arrange or a reading, and "Show all" fit the nodes and the overlay together (`frameDiagram`, through `overlayBounds`). The viewer and embeds draw the band read-only. The draw.io export writes it into a locked "Phases" layer of plain shapes (`structuraDecoration=1`), which the draw.io import ignores; a selection export leaves it out.
- **Editing and text.**
  - The Journey tab's "Phase" select picks an existing phase or creates one; picking the phase a step already inherits clears its start. A start naming the inherited phase opens nothing.
  - The outline writes `## Name` on its own line before the step that starts a phase.
  - Mermaid `journey` sections are phase starts, both ways.
  - The swimlane export keeps phases in a `%% phases: s1=Discover` comment.

## Known limits

- Cut and paste mints new ids, so a pasted step loses its derived-flow content.
- In guided mode the flows panel shows no "New flow" and does not offer removing the derived
  flow. The flow editor itself is still reachable through Edit, for step content; order changes
  made there are re-derived from the canvas.
- A lane is renamed through the inspector title. Its header label follows on the next
  derivation.
