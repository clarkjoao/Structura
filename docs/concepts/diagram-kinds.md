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
| `elements` | the palette and quick insert in kind mode (any registered type, plugin types included) |
| `interaction` | drag, resize, the Arrange menu's Manual/Automatic choice, recording flows |
| `create` | a new diagram's template |
| `conforms` (required) | whether a diagram edited freehand can come back; issues name their element |
| `derive` | derived content after every edit (guided: its flow) |
| `derivedFlowIds` | which flows `derive` owns (shown as derived, not removable) |
| `arrange`, `arrangeKey` | the arrangement, and what beyond structure triggers it (guided: lane order) |
| `checks` | quiet markers (a class on the node or edge, never a dialog) |
| `commands` | keyboard chords and context-menu entries |
| `elementActions` | per-element actions in the context menu and the inspector |
| `insert` | where a palette element goes in kind mode |
| `textCapture` | writing the diagram as text: `build` (text → edit), `serialize`, `syntax` |

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

## Known limits

- Cut and paste mints new ids, so a pasted step loses its derived-flow content.
- In guided mode the flows panel shows no "New flow" and does not offer removing the derived
  flow. The flow editor itself is still reachable through Edit, for step content; order changes
  made there are re-derived from the canvas.
- A lane is renamed through the inspector title. Its header label follows on the next
  derivation.
