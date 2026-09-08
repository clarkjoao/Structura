## Purpose

Derives call frames from the request/response pairs a flow already records, so reading a script shows
which calls are still owed a return, how deep the reader currently is, and lets them skip a call's
interior without losing their place.

## ADDED Requirements

### Requirement: A request on a connection opens a call frame

The system SHALL open a call frame for a step that names a connection AND declares
`payloadDirection: "request"`. A step with no connection, or with no payload direction, SHALL NOT
open a frame. The frame SHALL record the step that opened it, the connection, and the component the
call was made from.

#### Scenario: A request opens a frame

- **GIVEN** a step on connection `c1` with `payloadDirection: "request"`
- **WHEN** the call stack is derived
- **THEN** a frame is open for `c1` from that step onward

#### Scenario: A step with no direction opens nothing

- **GIVEN** a step on connection `c1` with no `payloadDirection`
- **WHEN** the call stack is derived
- **THEN** no frame is opened and the depth after the step equals the depth before it

#### Scenario: A step on a component opens nothing

- **GIVEN** a step that names only a `componentId`
- **WHEN** the call stack is derived
- **THEN** no frame is opened

### Requirement: A response closes the nearest matching frame

The system SHALL close a frame when a step names the same connection as an open frame AND declares
`payloadDirection: "response"`. When more than one open frame matches, the system SHALL close the
one nearest the top of the stack. Every frame above the closed one SHALL also be closed, each
producing a derived return.

#### Scenario: A response closes its own call

- **GIVEN** an open frame for `c1` and a later step on `c1` with `payloadDirection: "response"`
- **WHEN** the call stack is derived
- **THEN** the frame for `c1` is closed by that step and the depth after it is one lower

#### Scenario: A response closes frames left open above it

- **GIVEN** frames open for `c1` then `c2`, and a step on `c1` with `payloadDirection: "response"`
- **WHEN** the call stack is derived
- **THEN** `c2` is closed first with a derived return, then `c1` is closed by the step

#### Scenario: A response with no open frame is reported, not guessed

- **GIVEN** a step with `payloadDirection: "response"` on a connection with no open frame
- **WHEN** the call stack is derived
- **THEN** the step is assigned the current depth unchanged
- **AND** the step is reported as an orphan response, in the same shape the flow outline already
  reports unreachable steps

### Requirement: An async call does not deepen the reading

The system SHALL treat a step with `isAsync: true` as a call that is never returned. Such a step
SHALL NOT contribute to the depth of any later step, and SHALL NOT appear in the breadcrumb of open
frames.

#### Scenario: A fire-and-forget call leaves the depth alone

- **GIVEN** a step on connection `c1` with `payloadDirection: "request"` and `isAsync: true`
- **WHEN** the call stack is derived
- **THEN** the depth of the step that follows equals the depth of the async step

#### Scenario: A later response cannot close an async call

- **GIVEN** an async step on `c1` and a later step on `c1` with `payloadDirection: "response"`
- **WHEN** the call stack is derived
- **THEN** the later step is reported as an orphan response

### Requirement: A step's depth counts the frames open around it

The system SHALL assign each reachable step a call depth equal to the number of frames open when the
step begins. A step that opens a frame SHALL sit at the depth it had before its own frame was
pushed. A step that closes a frame SHALL sit at the depth of the frame it answers, so that a call
and its return land on the same row however many frames the response unwinds above it.

#### Scenario: A call and its return sit at the same depth

- **GIVEN** step `A` opens a frame and step `B` closes that same frame
- **WHEN** the call stack is derived
- **THEN** `A` and `B` are assigned the same depth

#### Scenario: Steps inside a call sit one level deeper

- **GIVEN** step `A` opens a frame and step `X` falls between `A` and the step that closes it
- **WHEN** the call stack is derived
- **THEN** `X` is assigned a depth one greater than `A`

#### Scenario: A response that unwinds several frames still meets its own call

- **GIVEN** step `A` opens a frame, a later step opens a second frame that is never answered, and
  step `B` answers `A`'s frame
- **WHEN** the call stack is derived
- **THEN** `B` is assigned the same depth as `A`, not one below the unanswered frame

### Requirement: Each branch inherits the stack of its branch point

The system SHALL derive depth over the same reachable steps and in the same order as the flow
outline. On entering a branch the system SHALL restore the stack as it stood at the condition that
opened it, so one branch's unclosed frames never leak into a sibling branch.

#### Scenario: A sibling branch starts from the branch point's stack

- **GIVEN** a condition at depth 1 whose branch `A` opens a frame that is never closed
- **WHEN** the call stack is derived
- **THEN** the first step of branch `B` is assigned depth 1

### Requirement: A frame that closes without an authored response produces a derived return row

The system SHALL render a return row in the reading spine for every frame closed without a step
declaring the response. The row SHALL name the component the call returns to, SHALL be marked as
derived, and SHALL carry no step number. Derived rows SHALL NOT be written into the flow's steps.

#### Scenario: The reading shows a return nobody wrote

- **GIVEN** a frame opened by a call to `Adquirente` that closes with no authored response step
- **WHEN** the reader reaches the point where the frame closes
- **THEN** a return row naming the caller is shown, marked as derived, with no step number

#### Scenario: An authored response suppresses the derived row

- **GIVEN** a frame closed by a step declaring `payloadDirection: "response"`
- **WHEN** the spine is built
- **THEN** that step is shown as an ordinary numbered step and no derived return row is added

#### Scenario: Deriving a return does not modify the flow

- **GIVEN** a flow with a frame that closes without an authored response
- **WHEN** the flow is read from first step to last
- **THEN** the flow's stored steps are unchanged

### Requirement: The spine indents by call depth

The system SHALL indent a spine row by its call depth, drawing one continuous vertical guide per
open frame so that a frame's extent is visible across the rows it contains. Step numbers SHALL
remain in a fixed-width column that does not move with depth.

#### Scenario: A nested step is indented

- **GIVEN** a step at call depth 2
- **WHEN** the spine is rendered
- **THEN** the step's content is indented by two levels and two guides run beside it

#### Scenario: Step numbers stay aligned regardless of depth

- **GIVEN** steps at depths 0 and 3 in the same reading
- **WHEN** the spine is rendered
- **THEN** both step numbers occupy the same column

### Requirement: The scene names the callers still waiting

The system SHALL show, on the step being read, the components whose frames are open, outermost
first. Selecting one SHALL move the reading to where that frame returns. At depth 0 the breadcrumb
SHALL NOT be rendered.

#### Scenario: The breadcrumb lists the open frames

- **GIVEN** the reader is on a step with frames open from `Cliente`, then `API`, then `Pagamentos`
- **WHEN** the scene is rendered
- **THEN** the breadcrumb reads `Cliente`, `API`, `Pagamentos` in that order

#### Scenario: No breadcrumb at the top level

- **GIVEN** the reader is on a step at depth 0
- **WHEN** the scene is rendered
- **THEN** no breadcrumb is rendered

### Requirement: Step over reads a call's result without its interior

The system SHALL offer a step-over control when the step being read opens a frame that has a
closing point. Using it SHALL move the reading to the step that closes the frame, or to the step
following the frame when the frame closes with a derived return. The control SHALL NOT be rendered
when the step opens no frame, or when the frame it opens never closes.

#### Scenario: Stepping over a call lands on its response

- **GIVEN** the reader is on a step that opens a frame closed by an authored response step
- **WHEN** the reader steps over
- **THEN** the reading moves to that response step

#### Scenario: Stepping over a call that returns implicitly

- **GIVEN** the reader is on a step that opens a frame closed by a derived return
- **WHEN** the reader steps over
- **THEN** the reading moves to the first step after the frame closes

#### Scenario: No step-over on a step that opens nothing

- **GIVEN** the reader is on a step with no `payloadDirection`
- **WHEN** the footer controls are rendered
- **THEN** no step-over control is offered

#### Scenario: No step-over into a call that never returns

- **GIVEN** the reader is on an async step
- **WHEN** the footer controls are rendered
- **THEN** no step-over control is offered

### Requirement: Step out leaves the current frame

The system SHALL offer a step-out control whenever the step being read sits at a depth greater than
zero, naming the component the innermost frame returns to. Using it SHALL move the reading to where
that frame closes.

#### Scenario: Stepping out returns to the caller

- **GIVEN** the reader is inside a frame opened by a call from `Pagamentos`
- **WHEN** the reader steps out
- **THEN** the reading moves to where that frame closes
- **AND** the control named `Pagamentos` before it was used

#### Scenario: No step-out at the top level

- **GIVEN** the reader is on a step at depth 0
- **WHEN** the footer controls are rendered
- **THEN** no step-out control is offered

### Requirement: Skipping steps still walks them

The system SHALL append every step passed over by step-over or step-out to the reading history, in
reading order, before the step the reader lands on. Stepping backwards after a skip SHALL retrace
those steps one at a time.

#### Scenario: Skipped steps enter the history

- **GIVEN** the reader steps over a call containing four steps
- **WHEN** the reading lands on the closing step
- **THEN** the history contains those four steps in order

#### Scenario: Going back after a skip retraces the interior

- **GIVEN** the reader has just stepped over a call
- **WHEN** the reader goes back
- **THEN** the reading moves to the last step inside the call, not to the call itself

### Requirement: A script with no directions reads exactly as before

The system SHALL derive depth 0 for every step of a flow in which no step declares
`payloadDirection`. For such a flow the reading SHALL render no indentation guides, no breadcrumb,
no derived return rows, and neither the step-over nor the step-out control.

#### Scenario: A flat script gains nothing and loses nothing

- **GIVEN** a three-step flow in which no step declares a payload direction
- **WHEN** the flow is read
- **THEN** every step is at depth 0
- **AND** no guide, breadcrumb, derived return, step-over or step-out control is rendered

### Requirement: Every string added by this capability is translated

All user-facing text introduced by the call stack — the derived return row, the step-over and
step-out control labels and titles, and the breadcrumb label — SHALL be supplied through i18n with
keys present in both `en` and `pt-BR`, with no inline default passed at the call site.

#### Scenario: Both locales carry every new key

- **WHEN** the flow namespace locale coverage check runs
- **THEN** every key used by the reading rail exists in `en` and in `pt-BR`
- **AND** no `t()` call in the reading supplies a default string
