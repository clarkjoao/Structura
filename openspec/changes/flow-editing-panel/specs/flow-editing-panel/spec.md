## Purpose

Puts the writing of a flow in one place with room for it, and leaves the flows panel doing the one
thing a list of flows is for — showing them, and saying which one the canvas is counting.

## ADDED Requirements

### Requirement: The flows panel lists and selects, and does not edit

The panel that lists a diagram's flows SHALL NOT offer any field of a step or of the running object.
Choosing a flow SHALL select it and nothing more, and choosing the selected flow again SHALL clear the
selection.

#### Scenario: No step is editable from the list

- **GIVEN** a diagram holding a flow with steps
- **WHEN** the flows panel is shown and a flow is chosen
- **THEN** no step field, and no key of the running object, is on screen

#### Scenario: Choosing a flow selects it

- **GIVEN** a flows panel with no flow selected
- **WHEN** a flow is chosen
- **THEN** it becomes the selected flow

#### Scenario: Choosing it again clears the selection

- **GIVEN** the selected flow
- **WHEN** it is chosen again
- **THEN** no flow is selected

#### Scenario: The selection is visible without opening anything

- **GIVEN** a selected flow among others
- **WHEN** the list is read
- **THEN** the selected flow is marked as the one the canvas is numbered from

### Requirement: A flow is written in a panel of its own

Editing a stored flow SHALL open the panel that holds an editing session, and while that panel is open
the flows list SHALL NOT be shown. Ending the session SHALL bring the list back. The panel SHALL show
the flow's script — its running object, its steps, and the fields of the step in hand.

#### Scenario: The pencil opens the editing panel

- **GIVEN** a stored flow in the list
- **WHEN** its edit action is chosen
- **THEN** an editing session opens for that flow

#### Scenario: The list stands aside

- **GIVEN** an editing session for a flow
- **WHEN** the workspace is rendered
- **THEN** the flows list is not shown

#### Scenario: The list comes back

- **GIVEN** an editing session that is finished or cancelled
- **WHEN** the workspace is rendered
- **THEN** the flows list is shown again

#### Scenario: The script is there

- **GIVEN** an editing session for a flow with steps
- **WHEN** the panel is shown
- **THEN** every step has a row, and choosing one shows its fields

### Requirement: The flow's own fields fold away, except its name

In the editing panel the flow's description, tags and participants SHALL sit behind a disclosure, and
the flow's name SHALL sit outside it. The disclosure SHALL start closed when an existing flow is
opened and open when a new recording starts.

#### Scenario: Opening a stored flow

- **GIVEN** a stored flow being edited
- **WHEN** the panel is shown
- **THEN** the name is editable and the description and tags are not on screen until the disclosure is
  opened

#### Scenario: Starting a new recording

- **GIVEN** a recording that has just started
- **WHEN** the panel is shown
- **THEN** the description and the tags are on screen

#### Scenario: The fields are still written

- **GIVEN** a stored flow being edited
- **WHEN** the disclosure is opened and the description is changed
- **THEN** the flow holds the new description

### Requirement: A call's fields are asked in the order the call is decided

For a step that travels a connection, the panel SHALL ask for the direction first, then the route, then
the body, then the shape expected back, then whether the call is asynchronous. The direction control
SHALL carry a label naming what it asks, not only the values it offers.

#### Scenario: The order on screen

- **GIVEN** a step that travels a connection, with its fields open
- **WHEN** the call's fields are read in order
- **THEN** direction comes before route, route before body, and the asynchronous choice comes last

#### Scenario: The direction is named

- **GIVEN** a step that travels a connection, with its fields open
- **WHEN** the direction control is read
- **THEN** it carries a label naming the question, alongside the two answers

#### Scenario: The shape expected back belongs to a request

- **GIVEN** a step whose direction is a response
- **WHEN** its fields are read
- **THEN** no field asks what shape is expected back

### Requirement: A flow's row leads with the two things done to a flow

A flow in the list SHALL offer editing and playing as named actions of their own, and SHALL offer
duplicating, copying and removing behind a single control. Every action SHALL keep an accessible name.

#### Scenario: The two that lead

- **GIVEN** a flow in the list
- **WHEN** its row is read
- **THEN** editing and playing are each reachable in one action

#### Scenario: The three that follow

- **GIVEN** a flow in the list
- **WHEN** the overflow control is opened
- **THEN** duplicating, copying as Mermaid and removing are offered, each by name

#### Scenario: Removing still removes

- **GIVEN** a flow in the list
- **WHEN** removing is chosen from the overflow
- **THEN** the flow is gone from the diagram

### Requirement: Every string this panel adds exists in both locales

Text introduced by the flows panel or the editing panel SHALL be resolved through the translation
layer and SHALL be present in every shipped locale, with no default supplied at the call site.

#### Scenario: A locale is missing a key

- **GIVEN** a string used by either panel
- **WHEN** the locale files are checked
- **THEN** the key is present in every shipped locale
