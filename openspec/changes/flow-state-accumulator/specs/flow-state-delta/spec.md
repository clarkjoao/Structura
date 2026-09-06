## Purpose

Says what the step in hand did to the running object — which values it introduced, which it wrote over,
and which went out of scope when a call ended — so the reader sees an event rather than a list that
happens to differ from the one before it.

## ADDED Requirements

### Requirement: The reading reports the change a step made to the running object

When the reading stands on a step, the system SHALL report the difference between the running object
folded over the path up to and including that step, and the running object folded over the path
without it. The report SHALL distinguish values introduced, values replaced, and values that left
scope. The report SHALL be derived from the walked path; the system SHALL NOT store it on the flow.

#### Scenario: A step that introduces a value

- **GIVEN** a reading standing on a step that sets a key nothing before it set
- **WHEN** the change is reported
- **THEN** the key is reported as introduced
- **AND** it is reported as neither replaced nor gone

#### Scenario: A step that writes over a value already in scope

- **GIVEN** a reading standing on a step that sets a key an earlier step already set
- **WHEN** the change is reported
- **THEN** the key is reported as replaced
- **AND** the value the earlier step gave it is carried in the report

#### Scenario: A step that closes a call holding values

- **GIVEN** a reading standing on a step that closes a frame in which values were introduced
- **WHEN** the change is reported
- **THEN** those keys are reported as gone
- **AND** the report names the call they left with

#### Scenario: The first step of a reading

- **GIVEN** a reading standing on the entry step
- **WHEN** the change is reported
- **THEN** everything that step sets is reported as introduced
- **AND** nothing is reported as replaced or gone

#### Scenario: A step that touches no values

- **GIVEN** a reading standing on a step that sets nothing and closes no frame
- **WHEN** the change is reported
- **THEN** the report is empty in all three categories

### Requirement: A value leaving with a call is visible before it leaves

While the reading stands on a step that closes a frame, the values held in that frame SHALL still be
shown, marked as leaving, together with the call they will leave with. On the following step they
SHALL be absent.

#### Scenario: The step that closes the frame

- **GIVEN** a reading standing on a step that closes a frame holding a value
- **WHEN** the running object is shown
- **THEN** the value is present and marked as leaving
- **AND** the call it leaves with is named

#### Scenario: The step after the frame closed

- **GIVEN** a reading that has moved past the step which closed that frame
- **WHEN** the running object is shown
- **THEN** the value is absent

### Requirement: Going back reports the change of the step arrived at

Reporting the change SHALL depend only on the path the reading has walked, so moving backwards
reports the change made by the step arrived at, not the one undone.

#### Scenario: Stepping back one step

- **GIVEN** a reading that walked forward past a step which introduced a value and then went back to it
- **WHEN** the change is reported
- **THEN** it reports that step introducing that value, exactly as it did on the way forward

### Requirement: Every string the panel adds exists in both locales

Text introduced by the change report SHALL be resolved through the translation layer and SHALL be
present in every shipped locale, with no default supplied at the call site.

#### Scenario: A locale is missing a key

- **GIVEN** a string used by the change report
- **WHEN** the locale files are checked
- **THEN** the key is present in every shipped locale
