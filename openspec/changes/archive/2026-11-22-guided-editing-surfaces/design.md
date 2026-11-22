## Context

The kind contract (ADR-0014) already declares `elements`, `insert` and `elementActions`. The guided kind implements them, and the catalog index and `useCatalogInsert` already use them. Three surfaces still read the freehand defaults:

- `ComponentPanel` with `KindActionsSection`;
- `QuickInsertPopover`, whose `TOP_GROUP_ID = "c4"` is fixed;
- `CanvasBottomToolbar`, which builds the `c4`/`flowchart` menus from the unfiltered `registryCatalog()`.

## Decisions

### 1. An optional `inspector` hook on the descriptor, as data

```ts
inspector?: {
  tab: KindText;                                    // "Journey"
  hiddenFields: readonly ("technology" | "type" | "shape")[];
  sections: (ctx, elementId) => KindInspectorSection[] | null; // null: no tab (lanes, notes)
};
type KindInspectorSection =
  | { type: "choice"; id; label; options: { id; label; element?; selected; run }[] }
  | { type: "labels"; id; label; items: { id; title; values?; placeholder?; label; commit }[]; empty? };
```

This keeps the contract as plain data plus pure functions, as ADR-0014 requires, with no React on the descriptor. The host draws the sections generically (`KindInspectorTab`) and applies what `run` or `commit` returns through `runKindOutcome`: a kind edit as one undo step, or a refusal shown as a notice. `kindInspectorFor(diagram, id)` resolves it only in kind mode, as `kindTextCaptureFor` does.

- _Alternative:_ a React component on the descriptor. Rejected because it breaks the "data + pure functions" rule a plugin kind will rely on.

### 2. `TabBar` takes a kind tab

`Tab` becomes `"kind" | "details" | "connections" | "services"`. The kind tab is first when present.

- The stored per-type preference (`elementPanelTabByType`) keeps working.
- The choice is stored under a separate key in kind mode (`<type>@kind`), so a Details choice made on a freehand diagram does not hide Journey.
- It falls back to `"kind"` when that tab exists and nothing is stored.

### 3. Guided Journey tab: three blocks built from existing edits

- **Lane:** segmented buttons, using `guidedMoveToLane`, the same edit `kindElementActionItems` uses for "moveTo". This removes `KindActionsSection`.
- **Step kind:** a new `guidedChangeShape(diagram, stepId, shape)`, which returns a `KindEdit` updating `flowShape`, width and height. It is refused when:
  - an end step would keep exits (`endHasNoNext`);
  - a start step would become the second start (`oneStart`);
  - the only start would stop being one (`keepStart`).

  Decision → step keeps every exit. The checks already flag multiple exits on a plain step; that is not refused, because the arrangement and derivation handle it.

- **Exits:** a list from `readGuided(...).outgoing`, with the label committed as a `relabel` kind edit, as one history step. With no exits yet, the section says Shift+Tab adds one.

The panel header's type chip shows the selected step kind (for example "Decision") instead of "Processes".

### 4. Hidden fields

`ComponentPanel` reads `kindInspectorFor(diagram, component)?.hiddenFields` and skips:

- `ElementTypeSelect` (type);
- the shape select inside `FlowchartFieldsSection`;
- the technology field.

There are no other changes to the panel.

### 5. Quick insert and toolbar read the kind's entries

- A new helper `kindCatalogFor(diagram, index)` returns `{ label: descriptor.label, entries }`. `entries` are the catalog entries matching `descriptor.elements`, in their order, relabelled with the element's `label` (for example "Data" instead of "Database").
- **QuickInsertPopover:**
  - uses that section instead of C4 when the kind is active;
  - filters recents through the (already filtered) `byId`;
  - drops empty sections.
- **Toolbar:**
  - uses `kindCatalogFor` over `registryCatalog()` in kind mode;
  - takes the main buttons from a new optional `primary?: true` on `KindElementRef`. Guided marks rectangle, diamond and end, which come first in `GUIDED_STEP_SHAPES`; the rest go under "More".
- Insertion already goes through `useCatalogInsert` → `descriptor.insert`.
- For a dropped connection, `useCatalogInsert` already passes `sourceNodeId` as the selection, so the guided insert adds after the source.
- A step inserted as an end is named "End", not "New step".

## Risks

- **Two ways to change the shape** (the Journey tab, and Details in freehand mode). This is accepted, because the modes are exclusive.
- **The stored tab preference could hide Journey after one visit to Details.** This is accepted, and consistent with the other tabs.
