# guided-journey-sharing Specification

## Purpose

Takes a guided journey to people and moments outside the editor: a Markdown document, one-click assistant reviews, and templates to start from.

## Requirements

### Requirement: The journey can be copied as a document

The Text panel's "Copy as…" SHALL offer "Document (Markdown)", and the panel SHALL offer to download the same text as `<diagram name>.md`. The document SHALL contain, in this order:

- the diagram's name as a title;
- one section per phase in reading order, with the steps before the first phase under their own heading;
- each step as a list item with its name, lane and participants;
- each decision with its exits as nested items, named by their labels and targets;
- a jump back written as "back to <step>".

All fixed words in the document SHALL go through i18n.

#### Scenario: A two-phase document

- **GIVEN** a journey with phases Descobrir (A, B) and Comprar (decision "Pagou?" with exits sim → C and não → back to A)
- **WHEN** the author copies it as Document
- **THEN** the text has the headings "Descobrir" and "Comprar", lists A and B under Descobrir, and lists "Pagou?" with "sim → C" and "não → back to A" under Comprar

### Requirement: Phase flows are derived from the step graph

Each phase flow SHALL be derived from the step graph, like the journey's flow: the phase's steps in reading order, entered at its start step. Phase flows SHALL be kept in sync on every structural edit and removed with their phase.

### Requirement: The assistant reviews the journey on request

In kind mode on an editable canvas, the guided mode bar SHALL offer "Review journey", with four presets:

- missing error paths;
- handoffs without an owner;
- decisions without a negative exit;
- customer language.

Picking one SHALL open the assistant and send that preset's request with the current journey. The answer SHALL arrive as a reviewable journey revision (spec `guided-assistant-revisions`). The request texts SHALL go through i18n.

#### Scenario: Error paths

- **GIVEN** a journey with a payment step and no failure branch
- **WHEN** the author picks "Review journey → Missing error paths"
- **THEN** the assistant receives that request with the journey, and its revision is shown for review

### Requirement: A guided diagram can start from a template

Creating a guided diagram SHALL offer:

- "Blank" (the current start step);
- the templates Checkout, Onboarding and Support ticket;
- "Paste meeting notes".

A template SHALL build its lanes, phases and steps as part of creating the diagram, and the blank template's lanes it leaves empty SHALL be removed, the start step moving into the lane of the step after it. "Paste meeting notes" SHALL create the blank journey, open the assistant with the pasted notes, and ask it to build the journey from them. Template names and content SHALL be translated (en and pt-BR).

#### Scenario: Checkout template

- **WHEN** the author creates a guided diagram from "Checkout"
- **THEN** it opens with only the template's lanes, at least two phases, and a decision with labelled exits
