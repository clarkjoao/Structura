# Structura Documentation

Documentation for contributors and maintainers. If you are an AI coding agent,
read [AGENTS.md](../AGENTS.md) first — it holds the hard rules; this tree holds
the *why* behind them.

## Map

| Area | What lives there |
| --- | --- |
| [architecture/](architecture/) | The Architecture Vision, overall architecture, extension-point inventory, plugin-system preparation, and roadmap analysis. Start here. |
| [adr/](adr/) | Architecture Decision Records — long-term decisions and their trade-offs. |
| [concepts/](concepts/) | How each subsystem works and why it is shaped that way (canvas engine, diagram engine, node system, persistence, …). |
| [grammar/](grammar/) | The canonical glossary of Structura's domain vocabulary. If a term is used differently in code, that's a bug. |
| [guides/](guides/) | Task-oriented guides for contributors (adding a node type, writing a spec, …). |
| [../openspec/](../openspec/) | Spec Driven Development via [OpenSpec](https://github.com/Fission-AI/OpenSpec): active changes in `changes/`, accepted requirements in `specs/`. |

## Reading order for new contributors

1. [architecture/vision.md](architecture/vision.md) — what Structura is becoming and the principles that govern it.
2. [architecture/overview.md](architecture/overview.md) — the layers and bounded contexts as they exist in the code today.
3. [grammar/glossary.md](grammar/glossary.md) — the canonical vocabulary. Read this before adding a new concept so it gets the right name.
4. [concepts/core-concepts.md](concepts/core-concepts.md) — the domain model in narrative form (workspace, diagram, component, connection, flow, scene, service).
5. The concept doc for whatever subsystem you are touching.
6. [../openspec/](../openspec/) — the engineering process (`/opsx:propose` → apply → archive), if you are proposing a feature.

## Document conventions

- Every document explains **how** it works *and* **why** it is that way.
  A doc that only restates the code is a maintenance liability; delete it.
- Documents describe the current state. Future plans belong in `openspec/` or
  `architecture/roadmap-analysis.md`; decisions belong in `adr/`.
- English is the canonical language for all documentation.
- When a doc contradicts the code, the code wins — and fixing the doc is part
  of the change that made it wrong.
