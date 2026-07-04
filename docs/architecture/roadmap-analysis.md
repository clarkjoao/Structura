# Roadmap Analysis

Architectural analysis of the planned features: dependencies, core-vs-plugin
placement, sequencing, and which specs must exist first. This is analysis,
not commitment — dates and staffing are out of scope.

## The dependency picture

Almost everything on the roadmap hangs off three platform investments:

```
Component-type extensibility (spec 0002) ──► VSM, Step Functions, Saga,
        │                                    Cell Builder improvements
Command system (spec 0003) ──────────────► Edge Panels UI, MCP, palette/toolbar work
Model Index (spec 0001) ─────────────────► Cross-diagram refs, Drill Down v2,
                                             Architecture Map, workspace AI Chat
Edge redesign (spec 0004) ───────────────► Edge Panels, VSM/StepFunctions/Saga edges
```

Building roadmap features before their platform dependency means building
them twice. That is the main sequencing claim of this document.

## Feature-by-feature

| Feature | Depends on | Core or plugin? | Spec |
| --- | --- | --- | --- |
| **Edge redesign** | nothing (unblocks others) | Core (engine) | 0004 |
| **Edge Panels** | edge redesign; command system for actions | Core UI, panel *sections* as contributions | 0004 |
| **Better draw.io import** | none (better: interchange registry) | Core today → Interchange contribution | 0006 |
| **Better draw.io export** | same | same | 0006 |
| **Cell Builder improvements** | pairs naturally with component descriptors (0002) | Per-type export contributions | 0006 |
| **Cross-diagram references** | Model Index | Core (identity is core) | 0001 |
| **Drill Down navigation** | exists (linkedDiagramId); v2 needs Model Index | Core | 0001 |
| **Architecture Map** | Model Index | Core view over the index | 0001 (view may split out) |
| **AI Chat** | exists per-diagram; workspace-wide needs Model Index | Core feature; providers are contributions | 0007 |
| **MCP Integration** | command system + patch contract | Contribution on a core MCP host | 0007 |
| **Value Stream Mapping** | 0002 + 0004 (+ 0005 to ship as plugin) | **Plugin** (diagram profile) | own spec after 0005 |
| **AWS Step Functions elements** | 0002 + 0004; states are semantic → benefits from 0001 | **Plugin** (profile) | own spec after 0005 |
| **Saga elements** | 0002 + 0004; compensation edges stress edge model hardest | **Plugin** (profile) | own spec after 0005 |

Core-vs-plugin rationale: *identity, commands, edges, and interchange
machinery* are platform (everyone's features sit on them); *diagram
vocabularies* (VSM, Step Functions, Saga) are the archetypal profiles and
must be plugins — if they can't be, spec 0005 failed its acceptance test.

## Recommended sequencing (and where it challenges the given order)

**Wave 1 — unblock (parallelizable):**
- **Spec 0002, component-type extensibility.** The single highest-leverage
  item; three roadmap features are new component vocabularies.
- **Spec 0004, edge redesign** (including the style→`edgeLayouts` migration
  and an `EdgeTypeDescriptor`). Edge Panels ride along as its UI phase.
- **Draw.io import/export improvements** can start immediately if user pain
  demands — they are isolated in Interchange. But doing spec 0006 first,
  and 0002 alongside, turns "better draw.io" from a patch into
  contribution-shaped fidelity work done once.

**Wave 2 — platform spine:**
- **Spec 0003, command system** (small, high fan-out).
- **Spec 0001, Model Index** (derived, read-only stage). Ships user-visible
  value directly: cross-diagram references, Drill Down v2, Architecture Map.

**Wave 3 — the payoff:**
- **Spec 0005, contribution points v1**, dogfooded by converting built-ins.
- **AI Chat (workspace-wide) + MCP** (spec 0007) on top of the command
  system and Model Index.
- **VSM, Step Functions, Saga** as the first true profile plugins — also the
  acceptance test for the whole platform phase.

**Challenges to the original roadmap ordering:**

1. VSM/Step Functions/Saga are listed first but must come **last**: built
   now, each hardcodes another vocabulary into the closed union and deepens
   the hole 0002 digs out of. Sequencing them last also makes them cheaper —
   they become mostly declarations.
2. "Edge redesign" and "Edge Panels" are listed mid-roadmap but the redesign
   belongs in **Wave 1**: three profile features and the panels all depend on
   the edge model, and the style-on-connection debt
   ([edge-system](../concepts/edge-system.md)) compounds with every feature
   that touches edges.
3. Cross-diagram references, Drill Down, and Architecture Map are one
   architectural feature (the Model Index) wearing three UIs — spec them
   together (0001), ship the UIs incrementally.
4. AI Chat should not precede the Model Index: per-diagram chat exists;
   workspace-wide chat without an index means prompt-stuffing 80 diagrams —
   a dead end worth not building.

## What to draft first, concretely

Spec 0002 (component-type extensibility) and spec 0004 (edge-system redesign)
— they unblock the most, touch the persisted schema (so earlier is safer),
and neither depends on the other.

## Reserved spec numbers

The numbers used throughout this document were reserved under the retired
pre-OpenSpec process (the old root `specs/` directory, removed 2026-07; its
README survives in git history). New design work starts as an OpenSpec change
in [`openspec/`](../../openspec/) instead, but the numbers remain the shorthand
this analysis uses:

| #    | Topic                                                                     | Status                                                            |
| ---- | ------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 0001 | architecture-model (workspace Model Index; ADR-0004 step a–b)             | Reserved                                                          |
| 0002 | component-type-extensibility (domain component descriptors)               | Reserved                                                          |
| 0003 | command-system                                                            | Reserved                                                          |
| 0004 | edge-system-redesign (incl. edge panels, layout migration)                | Reserved                                                          |
| 0005 | plugin-contribution-points (Extension API v1)                             | Absorbed by OpenSpec change `add-plugin-system-foundation` (2026-07) |
| 0006 | interchange-registry (importer/exporter contributions, draw.io fidelity)  | Reserved                                                          |
| 0007 | ai-workspace-integration (AI chat over Model Index, MCP)                  | Reserved                                                          |
