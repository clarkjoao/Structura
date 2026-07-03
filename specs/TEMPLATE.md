# Spec NNNN — Title

|                       |                                |
| --------------------- | ------------------------------ |
| **Status**            | Draft                          |
| **Authors**           | @handle                        |
| **Created / Updated** | YYYY-MM-DD / YYYY-MM-DD        |
| **Related**           | ADR-XXXX, spec NNNN, issue #NN |

> Delete sections that genuinely don't apply — but say so ("No migration:
> nothing persisted changes") rather than deleting silently. Keep the spec as
> short as honesty allows; a spec nobody reads specifies nothing.

## Background

Context a new contributor needs: what exists today (link concept docs, code),
what led here.

## Problem Statement

The problem in the users' terms, not the solution's. If you can't state who
is hurt and when, stop here.

## Goals

Bulleted, verifiable outcomes.

## Non-Goals

What this spec deliberately does not solve — with one line of _why_ each.
This section prevents scope creep during review and implementation; invest
in it.

## User Stories

“As a <role>, I … so that …” — including at least one story for the user who
does **not** use the feature (what must not get worse for them).

## Functional Requirements

Numbered (FR-1, FR-2, …) so reviews and acceptance criteria can reference
them.

## Non-Functional Requirements

Performance (canvas frame budget, bundle impact), i18n (en + pt-BR),
accessibility, persistence footprint, offline behavior.

## UX Considerations

Flows, entry points, empty/error states. Screenshots or ASCII mockups in
`assets/`. For platform-only specs: developer experience is the UX — show
the intended contributor-facing code.

## Architecture

How it fits the [bounded contexts](../docs/architecture/overview.md): which
contexts change, which contracts appear or widen, data flow. State explicitly
what is **core** vs. what is a **contribution** to a registry.

## Domain Model

New/changed types with TypeScript sketches. Persisted-shape changes must name
the migration and `PERSIST_SCHEMA_VERSION` bump.

## Extension Points

Which extension points this adds, widens, or consumes
([inventory](../docs/extension-points/README.md)). New ones follow the rules
in [ADR-0005](../docs/adr/0005-extension-philosophy.md).

## Alternatives Considered

Each serious alternative with the reason it lost. This section is mandatory
substance: it is what makes rejection or supersession cheap later.

## Risks

Technical, UX, and schedule risks, each with mitigation or an explicit
acceptance.

## Migration & Compatibility

Existing workspaces, persisted schema, exported files, URLs/share links,
collaboration protocol. "None" is a claim to defend, not a default.

## Acceptance Criteria

Checkable statements (map to FRs) a reviewer can verify to call the feature
done. These become the implementation PRs' checklist.

## Implementation Plan

Phases, each independently shippable and keeping `main` releasable. Name
what lands in which phase and rough size. This is the contract for splitting
PRs.
