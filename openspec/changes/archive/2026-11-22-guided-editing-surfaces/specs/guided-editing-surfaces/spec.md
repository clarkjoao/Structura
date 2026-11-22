## ADDED Requirements

### Requirement: A kind step has its own inspector tab

In kind mode, when the kind declares an `inspector` hook, the inspector for one of the kind's steps SHALL show a tab named by the kind (e.g. "Journey") as the first tab. It SHALL be selected when the step is opened, unless the author last chose another tab for that element type. Outside kind mode, and for elements that are not the kind's steps (lanes, notes, texts), the tab SHALL NOT appear.

#### Scenario: Selecting a guided step opens the Journey tab

- **WHEN** the author selects a step in a guided diagram in kind mode
- **THEN** the inspector shows the tabs Journey, Details and Connections, with Journey selected

#### Scenario: Freehand mode has no Journey tab

- **WHEN** the same diagram is switched to "Edit freehand" and the step is selected
- **THEN** the inspector shows Details and Connections as on any freehand diagram

### Requirement: The Journey tab moves a step between lanes

The Journey tab SHALL list every lane of the diagram, in lane order, as one choice group with the step's current lane marked. Picking another lane SHALL move the step there as one undo step, through the same kind edit as "Move to the lane above/below". The group SHALL end with a "New lane" option that adds a lane after the last one and moves the step into it, as one undo step. The selection SHALL stay on the step. The step's floating bar on the canvas SHALL NOT offer a lane menu: the Journey tab is where a step's lane is chosen (Alt+↑/↓ and the context menu remain).

#### Scenario: Moving to a new lane

- **WHEN** the author picks "New lane" for a step in a diagram with lanes Customer and Sales
- **THEN** a third lane "New lane" exists, the step sits in it, and one undo removes the lane and puts the step back

#### Scenario: No lane menu on the step's floating bar

- **WHEN** a guided step is selected on the canvas
- **THEN** its floating bar shows no "Lane" menu

#### Scenario: Moving to a lane two bands away

- **WHEN** a step in lane "Customer" is selected, the lanes are Customer, Sales and Billing, and the author picks "Billing"
- **THEN** the step sits in Billing, the arrangement and derived flow follow, and one undo puts it back in Customer

### Requirement: The Journey tab changes the step kind

The Journey tab SHALL offer the kind's step elements (for guided: step, decision, end, start, event, subprocess, data, document), with labels and icons, and the current one marked. Picking one SHALL change the step's shape as one undo step. A change the kind refuses (e.g. turning a decision with several exits into an end) SHALL leave the diagram unchanged and show the kind's reason.

#### Scenario: A step becomes a decision

- **WHEN** the author picks "Decision" for a selected step
- **THEN** the step is drawn as a diamond and its exits show in the Journey tab

#### Scenario: A decision with exits cannot become an end

- **WHEN** the author picks "End" for a decision that has two exits
- **THEN** nothing changes and a notice explains that an end step has nothing after it

#### Scenario: One start step

- **WHEN** the author picks "Start" for another step, or another kind for the only start
- **THEN** nothing changes and a notice explains that a guided diagram has one start step

#### Scenario: The header names the step kind

- **WHEN** a guided decision is selected in kind mode
- **THEN** the inspector header's type chip reads "Decision", not "Processes"

### Requirement: The Journey tab labels a decision's exits

For a decision, the Journey tab SHALL list its exits in reading order, each showing its target step's name and an editable label. Committing a label (Enter or blur) SHALL update that connection as one undo step. A decision with no exits SHALL show a hint that Shift+Tab adds one.

#### Scenario: Labelling an exit

- **WHEN** the author types "Approved" in the first exit's label and presses Enter
- **THEN** the connection reads "Approved" on the canvas and in the derived flow

### Requirement: Kind mode trims the Details tab

When the kind's `inspector` hook lists hidden fields, the Details tab SHALL NOT show those fields for the kind's steps in kind mode. Guided hides Technology, Type and Shape. Description, tags and links SHALL remain. The "Move to lane" strip below the inspector SHALL NOT be shown.

#### Scenario: A guided step's details

- **WHEN** the author opens Details for a guided step in kind mode
- **THEN** it shows Description, Tags and Links, and shows no Technology, Type or Shape field

### Requirement: Quick insert offers the kind's elements

In kind mode, when the quick insert opens (after a connection is dropped on empty canvas, or by its shortcut) with an empty field, it SHALL list the kind's elements, with the kind's labels for them, under a section named by the kind (e.g. "Guided"), instead of the C4 section. Recents SHALL include only entries the kind offers. A section with no entries SHALL NOT be shown. Picking an entry SHALL insert through the kind's `insert`, connected from the source step when there is one.

#### Scenario: Dropping a connection from a step

- **WHEN** the author drags a connection from "Start" onto empty canvas in a guided diagram
- **THEN** the popover lists Recents (journey entries only) and a "Guided" section with Step, Decision, End and the other step kinds, and no "C4" heading

#### Scenario: Picking Decision

- **WHEN** the author picks "Decision" there
- **THEN** a decision is added after "Start" in its lane, connected from it, as one undo step

### Requirement: The bottom toolbar offers the kind's elements

In kind mode, the bottom toolbar SHALL replace the C4 and Flowchart menus with one button per main element the kind names (guided: Step, Decision, End), followed by a "More" menu holding the kind's other elements. Each SHALL insert through the kind's `insert`. The text tool, catalog and view tools SHALL stay. Outside kind mode, the toolbar SHALL be unchanged.

#### Scenario: Adding a decision from the toolbar

- **WHEN** a step is selected in a guided diagram and the author clicks the toolbar's Decision button
- **THEN** a decision is added after that step, in its lane

#### Scenario: Freehand toolbar

- **WHEN** the diagram is in freehand mode
- **THEN** the toolbar shows the C4 and Flowchart menus as before

### Requirement: Surface text is translated

Every label this change adds (the tab name, field names, the "More" menu, section names, notices) SHALL exist in en and pt-BR.

#### Scenario: Portuguese

- **WHEN** the app is in pt-BR
- **THEN** the tab reads "Jornada", the fields "Raia", "Tipo de passo" and "Saídas", the toolbar buttons "Passo", "Decisão", "Fim" and "Mais", and the quick-insert section "Guiado"
