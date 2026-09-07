## Purpose

Lets a step in a script say which route it calls, so a reading names the API being exercised rather
than the edge it travels, and so a route on the canvas can be told which scripts exercise it.

## ADDED Requirements

### Requirement: A step may name the route it calls

A flow step MAY carry a reference to an endpoint. The reference SHALL be optional, and a step carrying
none SHALL behave exactly as a step written before the field existed. A step SHALL name at most one
endpoint.

#### Scenario: A step without an endpoint is unaffected

- **GIVEN** a flow whose steps name no endpoint
- **WHEN** the flow is read, exported and re-imported
- **THEN** it behaves exactly as it did before the field existed

#### Scenario: The reference survives a round trip

- **GIVEN** a step naming an endpoint
- **WHEN** the flow is saved and loaded again
- **THEN** the step still names the same endpoint

#### Scenario: The endpoint is gone

- **GIVEN** a step naming an endpoint that has since been deleted
- **WHEN** the flow is read
- **THEN** the reading continues and says the route is no longer there
- **AND** nothing about the step is silently dropped

### Requirement: The reading names a call by its route

When a step names an endpoint, the reading SHALL head that step with the endpoint's method and path in
preference to the component the step sits on or the label of the edge it travels. A heading the author
wrote SHALL still win over both.

#### Scenario: A call with a route

- **GIVEN** a step with no title of its own, naming an endpoint `POST /urls`
- **WHEN** the reading heads that step
- **THEN** the heading is the method and path

#### Scenario: The author wrote a heading

- **GIVEN** a step naming an endpoint and carrying a title
- **WHEN** the reading heads that step
- **THEN** the title is used

#### Scenario: Nothing changes for a step with no route

- **GIVEN** a step naming no endpoint
- **WHEN** the reading heads that step
- **THEN** the heading is what it was before this capability existed

### Requirement: A route knows which scripts exercise it

Given a diagram, the system SHALL be able to report, for any endpoint, the flows and steps that name
it. This SHALL be derived from the flows on each request; the endpoint SHALL NOT store it.

#### Scenario: A route two scripts call

- **GIVEN** two flows each with a step naming the same endpoint
- **WHEN** the callers of that endpoint are reported
- **THEN** both flows are named

#### Scenario: A route nothing calls

- **GIVEN** an endpoint no step names
- **WHEN** the callers of that endpoint are reported
- **THEN** the report is empty

#### Scenario: A step is deleted

- **GIVEN** an endpoint named by one step, and that step is deleted
- **WHEN** the callers of that endpoint are reported
- **THEN** the report is empty
- **AND** nothing on the endpoint had to be updated

### Requirement: An endpoint a step names counts as a participant

An endpoint named by a step SHALL be counted among the elements a flow touches, so coverage over a
diagram reports routes the way it already reports components and connections.

#### Scenario: Coverage over a route

- **GIVEN** a flow with a step naming an endpoint
- **WHEN** the diagram's coverage is built
- **THEN** the endpoint is listed as touched by that flow

### Requirement: A route the call cannot reach is reported, never blocked

When a step names both an endpoint and a connection, and the endpoint does not belong to the component
the connection arrives at, the system SHALL report the mismatch. It SHALL NOT refuse the step, alter
it, or prevent the reading from continuing.

#### Scenario: The route belongs elsewhere

- **GIVEN** a step whose connection arrives at one component and whose endpoint belongs to another
- **WHEN** the flow is checked
- **THEN** the mismatch is reported
- **AND** the step is unchanged and the reading continues

#### Scenario: The route is where the call lands

- **GIVEN** a step whose endpoint belongs to the component its connection arrives at
- **WHEN** the flow is checked
- **THEN** nothing is reported

#### Scenario: A step naming a route but no connection

- **GIVEN** a step naming an endpoint and no connection
- **WHEN** the flow is checked
- **THEN** nothing is reported, there being no call to disagree with

### Requirement: An author can choose the route without leaving the script

The panel in which a script is written SHALL let an author set and clear a step's endpoint, offering
the endpoints that exist on the diagram, identified by method and path.

#### Scenario: Setting a route

- **GIVEN** an author editing a step in a script
- **WHEN** they choose an endpoint
- **THEN** the step names it, and the script panel and the reading both show it

#### Scenario: Clearing a route

- **GIVEN** a step naming an endpoint
- **WHEN** the author clears it
- **THEN** the step names none, and the field is absent from the step rather than empty

### Requirement: Every string this adds exists in both locales

Text introduced by this capability SHALL be resolved through the translation layer and SHALL be present
in every shipped locale, with no default supplied at the call site.

#### Scenario: A locale is missing a key

- **GIVEN** a string introduced by this capability
- **WHEN** the locale files are checked
- **THEN** the key is present in every shipped locale
