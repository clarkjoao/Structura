## Purpose

Records what a branch point _is_ — a choice, a loop, threads running alongside — in a field of its
own rather than in the question the author wrote, and lets the reading tell a fork in the road apart
from a fork into threads.

## ADDED Requirements

### Requirement: A branch point declares its kind in a field of its own

The system SHALL record a branch point's kind on the step as `conditionKind`, one of `alt`, `opt`,
`loop`, `par`, `critical` or `break`. A step that declares none SHALL be read as `alt`. The system
SHALL NOT infer a kind from `conditionLabel`, which is the author's question and nothing else.

#### Scenario: A condition that never said otherwise is a choice

- **GIVEN** a condition with no `conditionKind`
- **WHEN** its kind is read
- **THEN** it is `alt`

#### Scenario: A question that reads like a keyword is still a question

- **GIVEN** a condition whose `conditionLabel` is `"loop"` and which declares a `conditionKind`
- **WHEN** its kind is read
- **THEN** the declared kind is used and the label is not consulted

#### Scenario: A kind on a step that forks nowhere means nothing

- **GIVEN** an action step carrying `conditionKind: "par"` and no branches
- **WHEN** the reading asks whether its ways out all happen
- **THEN** the answer is no, because it has no ways out

### Requirement: A keyword saved in the label is promoted on load

The system SHALL move a `conditionLabel` that is exactly one of the six keywords into
`conditionKind` when a flow is loaded, and clear the label. A label that is anything else SHALL be
left untouched, and a step that already declares a kind SHALL be left untouched whatever its label
says. The migration SHALL be idempotent.

#### Scenario: An imported block keeps its meaning

- **GIVEN** a stored condition whose `conditionLabel` is `"par"` and which declares no kind
- **WHEN** the flow is loaded
- **THEN** its kind is `par` and it carries no label

#### Scenario: An author's question survives

- **GIVEN** a stored condition whose `conditionLabel` is `"Cache hit?"`
- **WHEN** the flow is loaded
- **THEN** the label is unchanged and no kind is set

#### Scenario: Loading twice changes nothing further

- **GIVEN** a flow that has already been loaded once
- **WHEN** it is loaded again
- **THEN** every step is byte-identical to the first result

### Requirement: Mermaid carries the kind both ways without touching the label

The system SHALL write the block keyword of an imported `alt` / `opt` / `loop` / `par` / `critical` /
`break` into `conditionKind`, and SHALL leave `conditionLabel` unset — the text on a Mermaid block
header is the first branch's label, which is where it already goes. The exporter SHALL choose the
keyword from `conditionKind` alone, and the separator (`else` / `and` / `option`) from that keyword.

#### Scenario: A parallel block survives the round trip

- **GIVEN** a sequence containing `par Notificações` … `and Métricas` … `end`
- **WHEN** it is imported and exported again
- **THEN** the exported block reads `par Notificações` / `and Métricas` / `end`

#### Scenario: The block's own name is no longer overwritten

- **GIVEN** the same sequence
- **WHEN** it is imported
- **THEN** the condition's branches are labelled `Notificações` and `Métricas`, and the condition
  carries no `conditionLabel`

### Requirement: An author can say what a branch point is

The system SHALL offer the six kinds on the branch point's row in the script panel, and SHALL write
the chosen kind to the step without altering its question.

#### Scenario: Picking a kind reaches the step

- **GIVEN** an expanded condition row
- **WHEN** the author picks `par`
- **THEN** the step's `conditionKind` is `par` and its `conditionLabel` is unchanged

### Requirement: The reading tells threads apart from a choice

The system SHALL present a `par` as threads that all run: a distinct mark in place of `◇`, a statement
that following one way out does not rule out the rest, and a prompt to follow a thread rather than
to choose one. Every other kind SHALL read exactly as a condition read before this field existed.

The system SHALL mark, on each way out of a `par`, whether the reading has already been down it,
derived from every step the reading has stood on — not from the path to the step in hand, which
going back shortens, so a reader who explored a thread and returned would look as though they never
had. The system SHALL NOT mark a way out of a `par` as the one a value
points at, because no value chooses between threads.

#### Scenario: A parallel block is marked as threads

- **GIVEN** a reading on a `par` branch point
- **THEN** the step carries the parallel mark, the scene states that all of its ways out happen, and the footer
  asks the reader to follow a thread

#### Scenario: A thread already read is marked as read

- **GIVEN** a reading that entered the first thread of a `par` and then turned back to the fork
- **THEN** that thread is marked as read and the other is not

#### Scenario: A value never picks a thread

- **GIVEN** a reading on a `par` where a value read by the step matches a way out's label
- **THEN** no way out is marked as the one taken

#### Scenario: A kind that changes what happened says so in words

- **GIVEN** a reading on a `loop`, an `opt` or a `break`
- **THEN** the scene carries one line saying, respectively, that the part repeats, that it may not
  happen at all, or that the reading stops there — and a `loop` carries a mark of its own

#### Scenario: A choice reads exactly as it always did

- **GIVEN** a reading on a condition that declares no kind, or on a `critical`
- **THEN** the step is marked `◇`, no line is added above its ways out, and the footer asks the
  reader to choose a branch

### Requirement: A block inside a block survives the import

The system SHALL parse a conditional block nested inside another, keeping both branch points, their
kinds, their branch labels and every message inside them. It SHALL NOT discard a nested block.

#### Scenario: A decision inside a thread is kept

- **GIVEN** a sequence with an `alt` block inside one thread of a `par` block
- **WHEN** it is imported
- **THEN** both branch points exist with kinds `par` and `alt`, the inner one sits inside the outer
  one's first thread, and every message survives

#### Scenario: The nesting is written back out

- **GIVEN** the same sequence
- **WHEN** it is imported and exported again
- **THEN** the block structure comes back in the same order and the output is byte-stable

### Requirement: A branch point with no question is named by what it is

The system SHALL name a branch point that carries no title and no `conditionLabel` after its kind,
in the reader's language, rather than calling it untitled.

#### Scenario: An imported block is named

- **GIVEN** a `par` branch point with no title and no label
- **WHEN** its heading is derived
- **THEN** it reads as the translated name of `par`
