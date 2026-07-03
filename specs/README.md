# Specs — Spec Driven Development

From this point on, **every significant feature starts with a specification**
in this directory, written and reviewed before implementation. This is the
official engineering process for Structura.

## What needs a spec

A change needs a spec if any of these hold:

- It adds or changes an **extension point** or public contract.
- It changes the **persisted schema** in a way users will live with for years.
- It spans **multiple bounded contexts** ([overview](../docs/architecture/overview.md)).
- It is on the [roadmap](../docs/architecture/roadmap.md) as a named feature.
- Two contributors could reasonably build **incompatible versions** of it.

Bug fixes, refactors that preserve behavior, UI polish, and single-context
features do not need specs. When in doubt, open a Draft spec — a rejected
spec is cheap; a rejected implementation is not.

## Structure

```
specs/
├── README.md            this process
├── TEMPLATE.md          copy to start a spec
└── NNNN-short-slug/
    ├── spec.md          the specification (from TEMPLATE.md)
    └── assets/          optional: mockups, diagrams, sample files
```

Numbers are allocated sequentially by the PR that creates the spec; a spec
is a directory so it can carry assets and future amendments.

## Lifecycle

```
Draft → In Review → Approved → Implementing → Shipped
                  ↘ Rejected        ↘ Superseded (by spec NNNN)
```

The status lives in the spec's front-matter table and changes only via PR.

- **Draft** — author is exploring; anything may change. Open a Draft PR
  early for visibility.
- **In Review** — author considers it complete; review happens on the PR
  (see below).
- **Approved** — merged with approved status; implementation may begin.
  Approval means the _design_ is agreed, not that anyone is scheduled to
  build it.
- **Implementing / Shipped** — updated by the implementation PRs.
- **Rejected / Superseded** — merged for the record; rejected specs document
  why, which is often the most valuable part.

## Review workflow

1. Spec PRs are reviewed like code, by at least one maintainer.
2. Review focuses on: problem fit with the [vision](../docs/architecture/vision.md),
   contract quality of extension points, migration/compat plan, and honest
   Alternatives/Risks sections. A spec whose "Alternatives Considered" is
   empty is not ready for review.
3. Disagreements resolve in PR discussion; the resolution is written _into
   the spec_ (future readers must not need the PR thread).
4. If the spec makes a platform-level commitment, it links or creates an
   [ADR](../docs/adr/README.md) — the ADR records the _decision_ durably;
   the spec holds the _design_. A spec may be superseded; the ADR survives.

## Implementation workflow

1. Implementation PRs reference the spec (`Implements specs/NNNN`, link in
   the PR body) and should map to the spec's Implementation Plan phases —
   incremental, each phase keeping `main` releasable.
2. Reviewers check the diff **against the spec's acceptance criteria**.
3. Reality wins: when implementation reveals the spec was wrong, amend the
   spec in the same PR (or a preceding one) — never ship silently divergent
   behavior. The spec must describe what shipped.
4. When acceptance criteria are met, status → Shipped. The durable "how it
   works" moves into `docs/concepts/`; the spec remains as history.

## Contributor workflow (end to end)

```
idea → issue/discussion → Draft spec PR → review → Approved
     → implementation PRs (phased, referencing the spec)
     → docs/concepts updated → spec marked Shipped
```

For newcomers: pick up an **Approved** spec — the design fights are already
over, and the acceptance criteria tell you when you're done.

## Relation to ADRs and docs

| Artifact                       | Question it answers                                 | Mutability                                 |
| ------------------------------ | --------------------------------------------------- | ------------------------------------------ |
| Spec (`specs/`)                | _What are we building and how?_                     | Amended until Shipped, then frozen history |
| ADR (`docs/adr/`)              | _What long-term decision did we commit to and why?_ | Append-only; superseded, never edited away |
| Concept doc (`docs/concepts/`) | _How does the shipped system work?_                 | Always current; updated with the code      |

## Spec index

Numbers reserved per the [roadmap analysis](../docs/architecture/roadmap.md);
directories are created when drafting begins.

| #    | Spec                                                                     | Status   |
| ---- | ------------------------------------------------------------------------ | -------- |
| 0001 | architecture-model (workspace Model Index; ADR-0004 step a–b)            | Reserved |
| 0002 | component-type-extensibility (domain component descriptors)              | Reserved |
| 0003 | command-system                                                           | Reserved |
| 0004 | edge-system-redesign (incl. edge panels, layout migration)               | Reserved |
| 0005 | plugin-contribution-points (Extension API v1)                            | Reserved |
| 0006 | interchange-registry (importer/exporter contributions, draw.io fidelity) | Reserved |
| 0007 | ai-workspace-integration (AI chat over Model Index, MCP)                 | Reserved |
