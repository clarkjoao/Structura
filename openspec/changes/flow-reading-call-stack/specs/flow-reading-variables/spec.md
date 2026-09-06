## Purpose

Shows the reader the object a step carries — the body being sent, the body expected back, and the
values accumulated so far — so a developer following a script can see the contract of a call without
leaving the reading.

## ADDED Requirements

### Requirement: A step may declare what it produces, consumes and expects

A flow step MAY carry a context declaration with three optional members: the values the step
introduces, the keys the step consumes, and an explicit expected response body. Every member SHALL
be optional, and a step carrying none SHALL behave exactly as a step written before the field
existed. Values SHALL be stored as text; the system SHALL NOT parse, evaluate or type-check them.

#### Scenario: A step without a context declaration is unaffected

- **GIVEN** a flow whose steps carry no context declaration
- **WHEN** the flow is read
- **THEN** the reading behaves as it did before the field existed

#### Scenario: Declared values are stored verbatim

- **GIVEN** a step declaring the value `0.12` for the key `score`
- **WHEN** the flow is saved and read back
- **THEN** the value is returned unchanged as text

### Requirement: The reading shows the body a call sends

The system SHALL present the payload of the step being read as a navigable object when it is valid
JSON: nested objects and arrays SHALL be collapsible, and values SHALL be distinguishable by JSON
type. On a request the root SHALL be labelled as what the step sends; on a response, as what it
receives.

#### Scenario: A JSON payload is shown as an object

- **GIVEN** the step being read carries a payload that is valid JSON with a nested object
- **WHEN** the variables panel is rendered
- **THEN** the payload appears as a tree whose nested object can be collapsed and expanded

#### Scenario: A request and a response are labelled differently

- **GIVEN** two steps on the same connection, one a request and one a response
- **WHEN** each is read
- **THEN** the request's root is labelled as what is sent and the response's as what is received

### Requirement: The reading shows the body expected back

The system SHALL present, on a step that opens a frame, the body that the step closing that frame
carries, labelled as what is expected in return and marked as not yet reached. When the step
declares an explicit expected body, that declaration SHALL be shown instead of the derived one.

#### Scenario: The expected body is taken from the closing step

- **GIVEN** a request step whose frame is closed by a response carrying a JSON payload
- **WHEN** the request step is read
- **THEN** that payload is shown as the expected response, attributed to the step it came from

#### Scenario: The expected body is marked as a preview

- **GIVEN** a request step showing an expected response derived from a later step
- **WHEN** the variables panel is rendered
- **THEN** the expected response is visually distinguished from the body being sent

#### Scenario: An explicit declaration wins over the derived preview

- **GIVEN** a request step declaring an expected body of its own
- **WHEN** the step is read
- **THEN** the declared body is shown rather than the closing step's payload

#### Scenario: A fire-and-forget call expects nothing

- **GIVEN** a request step marked async
- **WHEN** the step is read
- **THEN** the panel states that nothing comes back, rather than omitting the section

### Requirement: A declared expectation is compared against what arrives

When a step declares an explicit expected body AND the frame it opens is closed by a step carrying a
JSON payload, the system SHALL compare the two and report keys that are expected but absent, and
keys that arrive but were not expected. The comparison SHALL report only; it SHALL NOT prevent
reading, block saving, or alter either body.

#### Scenario: A matching response is confirmed

- **GIVEN** a step declaring an expected body whose keys all arrive in the response
- **WHEN** the response step is read
- **THEN** the panel confirms the response matches what was expected

#### Scenario: A missing key is reported

- **GIVEN** a step expecting the keys `score` and `limite`, closed by a response carrying only `score`
- **WHEN** the response step is read
- **THEN** the panel reports `limite` as expected but absent
- **AND** the reading continues unaffected

### Requirement: The reading accumulates the values steps introduce

The system SHALL derive a running object by folding, in reading order over the steps already walked,
the values each step declares it introduces. A value SHALL be attributed to the step that introduced
it. The running object SHALL be derived on demand from the walked path and SHALL NOT be stored.

#### Scenario: A value appears when the step that introduces it is read

- **GIVEN** a step introducing `score`
- **WHEN** the reader reaches that step
- **THEN** `score` appears in the running object, marked as introduced by this step

#### Scenario: A later value replaces an earlier one under the same key

- **GIVEN** two steps introducing the same key with different values
- **WHEN** the reader has walked both
- **THEN** the running object holds the later value

#### Scenario: Going back restores the earlier state

- **GIVEN** the reader has walked past a step that introduced `score`
- **WHEN** the reader steps back before that step
- **THEN** `score` is absent from the running object

### Requirement: Values are scoped to the frame that produced them

The system SHALL group the running object by the call frame the introducing step sat in. When a
frame closes, the values introduced inside it SHALL leave the running object, except those carried
by the step that closes the frame.

#### Scenario: The running object is grouped by frame

- **GIVEN** values introduced at three different call depths
- **WHEN** the running object is rendered
- **THEN** values are grouped under the frame each was introduced in, innermost first

#### Scenario: A closed frame takes its locals with it

- **GIVEN** a value introduced inside a frame and not carried by the step that closes it
- **WHEN** the reader passes the point where the frame closes
- **THEN** that value is no longer in the running object

#### Scenario: What the response carries survives the return

- **GIVEN** a value introduced by the step that closes a frame
- **WHEN** the reader passes the point where the frame closes
- **THEN** that value remains in the running object, in the caller's frame

### Requirement: A step shows which values it consumes and where they came from

The system SHALL distinguish, among the running object, the keys the step being read declares it
consumes. For each such key the system SHALL name the step that introduced it and offer to move the
reading there. A consumed key that no earlier step introduces SHALL be reported.

#### Scenario: Consumed keys are distinguished

- **GIVEN** a step declaring it consumes `cliente.cpf`
- **WHEN** the step is read
- **THEN** `cliente.cpf` is shown distinguished from the values the step does not consume

#### Scenario: A value names its origin

- **GIVEN** a consumed key introduced three steps earlier
- **WHEN** the step is read
- **THEN** the origin step is named
- **AND** selecting it moves the reading to that step

#### Scenario: Consuming a key nobody sets is reported

- **GIVEN** a step declaring it consumes a key no earlier step introduces
- **WHEN** the flow is read
- **THEN** the key is reported as unset, in the same shape the flow outline already reports
  unreachable steps

### Requirement: A condition shows the value it tests

The system SHALL display, on a condition step that declares consumed keys, the current value of each
consumed key alongside the question, and SHALL mark which of the ways out those values lead to when
a branch label corresponds to one. A condition that declares no consumed keys SHALL render as it
does today.

#### Scenario: The condition displays its input

- **GIVEN** a condition asking about `score`, declaring it consumes `score`, whose value is `0.12`
- **WHEN** the condition is read
- **THEN** the value `0.12` is shown with the question, attributed to the step that introduced it

#### Scenario: A condition without declared inputs is unchanged

- **GIVEN** a condition declaring no consumed keys
- **WHEN** the condition is read
- **THEN** only the question and its ways out are shown

### Requirement: A payload that is not JSON keeps its current treatment

The system SHALL show a payload that does not parse as JSON as text, exactly as it is shown today,
and SHALL NOT report a parse failure as an error to the reader.

#### Scenario: Free text stays free text

- **GIVEN** a step whose payload is prose rather than JSON
- **WHEN** the step is read
- **THEN** the payload is shown as text with no error reported

### Requirement: The panel is absent when it has nothing to show

The system SHALL NOT render the variables panel, nor the divider that separates it from the spine,
when the step being read has no payload, no expected response, and the running object is empty.

#### Scenario: A script with no data shows no panel

- **GIVEN** a flow whose steps carry no payload and no context declaration
- **WHEN** the flow is read
- **THEN** no variables panel and no divider are rendered

#### Scenario: The panel appears only where there is something to see

- **GIVEN** a flow where only one step carries a payload
- **WHEN** the reader moves onto that step
- **THEN** the panel appears
- **AND** it is absent again on the steps either side that carry nothing

### Requirement: Every string added by this capability is translated

All user-facing text introduced by the variables panel — the root labels, the empty and
nothing-comes-back statements, the comparison result, and the origin attribution — SHALL be supplied
through i18n with keys present in both `en` and `pt-BR`, with no inline default passed at the call
site.

#### Scenario: Both locales carry every new key

- **WHEN** the flow namespace locale coverage check runs
- **THEN** every key used by the variables panel exists in `en` and in `pt-BR`
- **AND** no `t()` call in the panel supplies a default string
