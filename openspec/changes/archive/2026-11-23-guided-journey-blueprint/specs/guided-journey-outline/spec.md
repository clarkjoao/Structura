# Spec Delta

## MODIFIED Requirements

### Requirement: The outline format

The outline SHALL be line-based text in which each non-blank line, after its indentation, is one of the following:

- **Comment.** A line starting with `#`.
- **Step.** `[Lane[, Participant…]:] name`: a step with the default step shape.
- **Decision.** `[Lane[, Participant…]:] ? name`.
- **End step.** `[Lane[, Participant…]:] ! name`.
- **Jump.** `-> @name`: a connection to an existing step, which ends the current path.
- **Exit.** `label -> <step, decision, end or jump>`: valid only directly under a decision, indented or right after it. `-> <step>` is an exit without a label.
- **Lane declaration.** `Lane:` alone: declares the lane and makes it current, adding no step.
- **Line of visibility.** `---` alone, between lane declarations: the line of visibility sits before the next declared lane.

The lane rules SHALL be:

- `Lane:` is the text before the first `: `.
- In a step's prefix, the names after the first `,` are the step's participants (spec `guided-journey-blueprint`); the first name is the lane.
- A line without a lane stays in the lane of the line before it, and has no participants.
- The first line without a lane uses the diagram's first lane.

`\:` SHALL write a literal colon that is not a lane prefix. `\,` SHALL write a literal comma inside a lane or participant name. `→` SHALL be accepted wherever `->` is. Lane names SHALL match existing lanes trimmed and case-insensitively. The syntax SHALL NOT depend on the interface language.

A `---` line anywhere other than between lane declarations SHALL be an error on that line. Copy as text SHALL write `---` before the first backstage lane's declaration, and each step's participants after its lane, writing the lane prefix whenever the step has participants.

#### Scenario: A linear journey across lanes

- **GIVEN** a guided diagram with lanes "Cliente" and "App"
- **WHEN** the outline `Cliente: Escolhe produto` / `App: Gera cobrança` / `Envia QR code` is added
- **THEN** three steps are created in sequence: "Escolhe produto" in "Cliente", and "Gera cobrança" and "Envia QR code" in "App"

#### Scenario: A lane prefix that matches no lane

- **GIVEN** a guided diagram without a lane named "API"
- **WHEN** an outline containing `API: Confirma pagamento` is added
- **THEN** a lane named "API" is created after the existing lanes, and the step is placed in it

#### Scenario: Comments and blank lines

- **GIVEN** a guided diagram
- **WHEN** an outline contains blank lines and lines starting with `#`
- **THEN** those lines add nothing to the journey

#### Scenario: Participants and the line of visibility

- **GIVEN** a new guided diagram
- **WHEN** the outline `Cliente:` / `---` / `Atendente:` / `Cliente, Atendente: Revisa pedido` is added
- **THEN** the line of visibility sits above Atendente, and "Revisa pedido" is in Cliente with participant Atendente

#### Scenario: A misplaced separator

- **WHEN** a `---` line follows a step line
- **THEN** that line is reported as an error and nothing is added
