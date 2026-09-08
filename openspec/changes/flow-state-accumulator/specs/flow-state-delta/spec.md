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
- **THEN** the key is reported as replaced, and not as introduced

#### Scenario: A value that comes back when the call that hid it ends

- **GIVEN** a key written both inside a call and outside it, and a reading standing on the step that
  ends that call
- **WHEN** the change is reported
- **THEN** the key is reported as replaced, holding the value it had before the call
- **AND** it is reported as neither introduced nor gone

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

### Requirement: The running object is shown as one object

The reading SHALL show the running object as a single object, in the order its keys were first
introduced along the walked path. It SHALL NOT group the values by the call each was introduced
inside, and SHALL NOT show a key more than once.

#### Scenario: A key written both inside a call and outside it

- **GIVEN** a reading whose path writes the same key at two depths
- **WHEN** the running object is shown
- **THEN** there is one row for that key, holding the value in force

#### Scenario: The order does not shuffle as the reading walks

- **GIVEN** a reading whose path writes one key outside a call and a later key inside one
- **WHEN** the running object is shown
- **THEN** the keys read in the order they were first introduced

### Requirement: A value the step in hand wrote is marked, and marked once

A value introduced or replaced by the step in hand SHALL be marked so it is distinguishable from one
set earlier, and the marking SHALL survive the reader's attention moving elsewhere. The mark SHALL be
a single indicator on the value's own row; the reading SHALL NOT repeat in words beside the value what
the change report above it already says, and SHALL NOT show the value that was replaced beside the one
that replaced it — that history belongs to the key's own life. Each mark SHALL carry its meaning in
words for a reader who asks for it. A reader who has asked for reduced motion SHALL still get the mark.

#### Scenario: A value this step wrote

- **GIVEN** a reading standing on a step that writes over a value already in scope
- **WHEN** the running object is shown
- **THEN** the value carries a mark saying it was replaced
- **AND** neither the word nor the value it replaced is shown beside it

#### Scenario: A value an earlier step wrote

- **GIVEN** a reading standing on a step that touched none of the values on screen
- **WHEN** the running object is shown
- **THEN** no value is marked

### Requirement: A value leaving with a call is visible before it leaves

While the reading stands on a step that closes a frame, the values held in that frame SHALL still be
shown, marked as leaving, together with the call they will leave with. On the following step they
SHALL be absent.

#### Scenario: The step that closes the frame

- **GIVEN** a reading standing on a step that closes a frame holding a value
- **WHEN** the running object is shown
- **THEN** the value is present, in the object, marked as leaving
- **AND** the call it leaves with is named in the change report above

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
