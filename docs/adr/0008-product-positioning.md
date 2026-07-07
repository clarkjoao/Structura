# ADR-0008 — Product positioning, audience, and tempo

**Status:** Accepted

## Context

Three product decisions were open after the v0.2.0 ship (the five renames
in `feat/glossary`):

1. **Business model** — open core vs. pure community / sponsorship.
2. **Strategic posture** — incremental product vs. moonshot.
3. **Primary audience** — developers, architects, BA/PM, or UX designers.

These decisions shape every product investment that follows. Without
recording them explicitly, every future contributor (including the
maintainer themselves, six months from now) re-litigates the same
trade-offs in ad-hoc reasoning and the codebase drifts.

This ADR records the choices made in 2026-07 with full awareness of
the relevant trade-offs, and binds the maintainer and future
contributors to a single coherent strategy for the next 12 months.

## Decision

### 1. Business model — open core, no hosted SaaS in the planning horizon

Structura is **open core**: the entire engine is MIT-licensed and
ships as a self-hostable, local-first tool. The decision is **not**
to invest in a hosted SaaS product in the planning horizon (next
12 months). If a hosted offering emerges later, it will be a separate
product built on top of the same engine, with its own ADR.

The reason this is not "pure community" is that open core leaves the
door open to a future cloud offering without forcing a relicense or
a re-architecture. The engine's bounded contexts (`features/diagram`,
`features/canvas`, `features/walkthroughs`, etc.) and the storage port
(`IStoragePort`) are already factored to allow a remote adapter
without touching the engine.

### 2. Strategic posture — moonshot

The product goal is to be the **canonical modeling language for
software architecture**. This is a moonshot: it requires coverage of
the full architect's workflow (C4, deployment, integration, domain,
value stream, capabilities, decisions, ADR) at a quality bar that
replaces ad-hoc diagramming tools. Incremental scope-creep into BPMN,
UML, or generic whiteboards dilutes the vision and forfeits the
moonshot.

Concretely, the moonshot commits the maintainer to:

- **Rejecting "draw.io with semantic edges" as a target.** The
  product is opinionated; the cost of opinionated vocabulary is a
  hard ceiling on flexibility, and that cost is paid willingly.
- **Investing in Profile as the unit of vocabulary expansion**
  (`spec 0005` roadmap item) rather than hardcoding diagram types.
- **Investing in Model Index (`spec 0001`)** as the substrate that
  makes cross-diagram reasoning and AI-workspace context possible.
  This is the foundation that makes "modeling language" a claim
  with teeth.
- **Saying no to BPMN, ArchiMate, and UML coverage.** Each of these
  is a separate moonshot with its own ecosystem. Lint, not adopt.

### 3. Primary audience — software developers and software architects

The primary audience is **developers and architects who model systems
they build or maintain**. The product is a tool for people who think
in systems, not a tool for end-user designers or business analysts.

Concretely:

- **The vocabulary targets engineering primitives.** C4 levels,
  container, component, deployment, integration, domain bounded
  contexts. Not: BPMN pools and lanes, customer-journey touchpoints,
  stakeholder maps.
- **The interaction targets engineering workflows.** Drill-down,
  cross-diagram reference, service catalog, ADRs attached to
  diagrams. Not: presentation, animation, real-time collaboration as
  a primary feature.
- **The secondary audience is BA/PM only when they read models that
  engineers wrote.** They are not the user the product optimizes for;
  any feature that improves the BA's authoring experience at the cost
  of an engineer's authoring experience is declined.

### 4. Tempo — solo maintainer

The maintainer works on this project solo. Roadmap phases are
sequenced so that each phase is small enough to be completed in
1-3 weeks of focused work, and each shipped phase leaves the
codebase in a state where the maintainer can pause for 2-3 weeks
without leaving the project in an unstable state. The moonshot is
explicitly a multi-year effort; pacing is the constraint that
prevents the moonshot from collapsing into abandonment.

This tempo implies:

- **Horizon 1 hygiene between every release.** A solo maintainer
  cannot debug a half-finished Horizon 3 feature six months later
  without first re-orienting on a clean codebase.
- **Specs over code for multi-week work.** Multi-week features ship
  with an OpenSpec change so the maintainer can pick the work up
  cold.
- **Reversibility over speed.** Each rename ships with a deprecated
  alias for one release rather than breaking the public surface.
  When a single commit can take 2 hours to revert across the
  community, reversible-by-default is the right default.

## Consequences

- (+) Single coherent strategy. No more re-litigation of the same
  trade-offs at every planning cycle.
- (+) Engine is structured to allow a future hosted product without
  re-architecture. The pluggable seams exist; the decision is
  whether to use them.
- (+) The moonshot claim is auditable: every roadmap item can be
  judged against "does this advance the modeling language or does
  it just help people draw diagrams?". Items that fail this test are
  declined.
- (+) Solo tempo is honored. Horizon 1 hygiene is non-optional.
- (−) The hosted SaaS revenue model is closed for now. If the
  project needs funding beyond sponsorship, the maintainer will
  need to revisit.
- (−) Saying no to BPMN/UML/ArchiMate may disappoint external
  observers. The product is opinionated; opinionated products
  exclude.
- (−) The moonshot is a long bet. The maintainer commits to the
  duration of the bet.

## Review trigger

This ADR is reviewed when any of:

- A hosted SaaS offering is concretely scoped.
- A primary-audience shift is proposed (e.g. UX designers become a
  significant share of users).
- The maintainer is no longer solo (a team would invalidate the
  tempo assumption).
- A competitor (Structurizr, IcePanel, Backstage) makes a move that
  reframes the moonshot's competitive position.

Until then, this ADR is binding for 12 months from acceptance.