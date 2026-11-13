# Proposal

## Why

Large generated diagrams are hard to read. The worst offenders are long lines and crossings, and
most of both come from connections that point back against the reading direction: a target far to
the left of its source makes a line that crosses most of the canvas.

The automatic references the arrangement makes today barely help at that size. They are tried hub
by hub and kept only where the drawing measurably reads better, and since `large-diagram-arrange`
a large diagram gets one or two trials. Measured with the arrangement's own score
(`RELATORIO-REFS.md`), against the same layout without references:

|                                           | Fixture, 657 nodes           | Test, 1,000 nodes / 1,200 connections |
| ----------------------------------------- | ---------------------------- | ------------------------------------- |
| References by trial (today)               | −0.1% crossings, 1 reference | −2%, 2 references                     |
| A reference for every far back-connection | **−63%**, 129 references     | **−63%**, 179 references              |

A reference per far back-connection also lays out faster than the trials: it costs two ELK runs.

## What Changes

- References follow reading rules by default. A connection whose target sits more than N columns
  back (default 2) ends on a reference to the target, beside its consumer. A nearer one stays a
  short back-edge, as ADR-0013 draws it.
- There is one reference per original and consumer container, never one per connection.
- An original keeps at least K connections (default 1): when the rules would take more, the
  closest consumers stay on it.
- Optionally, a forward connection longer than 6 columns ends on a reference too (off by default).
- `DiagramLayoutSettings` gains:
  - `references: "rules" | "auto" | "off"`, where absent means `rules`;
  - `refNeighborColumns` (1–6);
  - `refMinKeep` (1–5);
  - `refForward`.
- The trial mode stays available as `auto`.
- The Arrange menu's Advanced section gets a References control: the mode, and under `rules` the
  neighbour distance, the connections kept on the original, and forward references.
- The success toast says what the rules did: back-connections found, those kept as back-edges,
  those moved, and the references made.

## Impact

- The default arrangement changes for any diagram whose layout has connections pointing more than
  two columns back.
  - Such a connection only exists in a cycle, or between containers.
  - The layout baselines, reference and generated diagrams are unaffected; every unit test passes
    unchanged.
  - Diagrams that store no settings still store nothing.
- No persisted schema change: the fields are optional and normalised like the other layout
  settings. The collaboration relay carries `layoutSettings` as an opaque value.
- Seeds and generation (`applySeedAutoLayout`) arrange without references, as before.
