# ADR-0013 — A diagram declares its reading direction: left-to-right or top-to-bottom

**Status:** Accepted

## Context

AGENTS.md makes left-to-right a hard rule: on every node the left handles are input only and
the right handles are output only, so an edge always leaves its source on the right and arrives
at its target on the left. The side is never derived from geometry. Moving a node must not
rewire an edge, and a deliberate back-edge keeps reading as one. This is the draw.io contract,
locked by `edges/connectionDerivations.fixedSides.test.ts`. The one declared extension is the
flowchart shapes (`verticalSides`): an edge may store `sourceSide: "bottom"` / `targetSide:
"top"`, and those sides are still the edge's choice.

The layout work (`diagram-layout-settings`, `diagram-auto-arrange`) brought the request for a
**vertical** layout, as in React Flow's elkjs example: the same diagram read top-to-bottom.
Several things today assume left-to-right:

- **Node renderers.** 12 node files place their handles with `Position.Left` / `Position.Right`
  directly (`CardNode/Handles.tsx`, `SkinHandles.tsx`, `PanelNode`, `NoteNode`, `DbTableNode`,
  `ProcessNode`, …).
- **The layout path.** ELK runs with `elk.direction: RIGHT` and ports pinned `EAST`/`WEST`
  (`layoutEngine.ts`). `elkHandleOrder`, `alignElkRouteToHandles`, `edgeLayoutsFromLayoutResult`
  and `renderedEdgePath` read the routes as horizontal corridors. The spacing defaults were tuned
  for wide C4 cards laid out in columns. The automatic placement (`incrementalPlacement.ts`) puts
  a new element "one column to the right".
- **Edge geometry.** `edges/geometry/orthogonal.ts` routes an orthogonal path out of a right
  handle and into a left one.
- **Exports.** The draw.io export core (`lib/export-core`, plus the copy in the LeanIX plugin)
  writes `exitX`/`entryX` for right/left. The Mermaid flowchart importer parses `TD`/`TB` and
  then ignores the direction.
- **Collaboration.** The relay accepts only a fixed allowlist of `doc` fields (`isDocField` in
  `server/src/collab/protocol.ts` and `go-server/internal/protocol/validate.go`). A patch
  carrying an unknown field is refused.

Four directions were weighed:

- **Rotate the canvas.** Draw the left-to-right diagram rotated 90°.
  - Nothing in the model changes.
  - Text rotates with it, and pan/zoom, handles and selection all have to be counter-rotated.
  - Rejected.
- **Per-edge sides everywhere.** Extend `verticalSides` to every node type and let each edge pick
  its sides.
  - No new diagram concept.
  - The diagram no longer has one reading, the auto-layout cannot pick an ELK direction, and
    authors would have to re-side every edge by hand.
  - Rejected.
- **Derive the side from geometry** (React Flow's elkjs example sets `sourcePosition` /
  `targetPosition` from the layout direction per node).
  - Simplest to wire.
  - It is exactly what the hard rule forbids: moving nodes would rewire edges.
  - Rejected.
- **A declared reading direction on the diagram.**
  - The rule keeps its substance: sides are fixed by a declaration, never by geometry. Only the
    axis becomes a property of the diagram instead of a constant.

## Decision

1. **A diagram declares its reading direction.** The field is
   `Diagram.direction?: "TB"`; absent means left-to-right, so every existing diagram, export and
   hash is unchanged. It is diagram data, not a layout preference: it changes which handle an
   edge uses, so it is not stored in `layoutSettings`.
2. **The hard rule is restated per axis.** In a left-to-right diagram, left is input and right is
   output (today). In a top-to-bottom diagram, top is input and bottom is output, on every node.
   In both, the side comes from the declaration and the edge's own stored side, never from where
   the nodes sit. Moving a node never rewires an edge, and a back-edge still reads as one.
3. **Stored sides stay absolute; the default follows the direction.**
   - `Connection.sourceSide` / `targetSide` name a real side (`"bottom"`, `"top"`, and in a
     top-to-bottom diagram `"right"` / `"left"`).
   - An edge stores a side only when it is not the default for the diagram's direction.
   - It is honoured only on a node whose handle spec declares the cross-axis extension. Today's
     `verticalSides` becomes `crossAxisSides`: the flowchart shapes get top/bottom in a
     left-to-right diagram and left/right in a top-to-bottom one.
   - An existing `"bottom"`/`"top"` edge keeps meaning what it means today.
4. **Node renderers stop hard-coding sides.** A single `inputSide(direction)` /
   `outputSide(direction)` (and the cross-axis pair) feeds every renderer. The direction reaches
   the canvas through the view layer (`resolveViewSnapshot`), so the editor and the viewer draw the
   same handles. `connectionDerivations` keeps owning which handle an edge uses.
5. **Switching the direction is one whole-diagram operation, and one undo step.** It sets the
   field, drops every stored edge route (the corridors were drawn for the other axis), runs the
   full arrangement in the new direction, and fits the view. A diagram is never left half in one
   axis and half in the other. The automatic mode places along the axis: one row below the source
   in a top-to-bottom diagram.
6. **The layout runs per direction.**
   - `elk.direction` is `DOWN` and ports go `NORTH`/`SOUTH` for top-to-bottom.
   - The route readers (`elkHandleOrder`, `alignElkRouteToHandles`, `edgeLayoutsFromLayoutResult`,
     `renderedEdgePath`, `autoRefs`, `orthogonal`) take the axis instead of assuming horizontal.
   - Top-to-bottom gets its own measured spacing defaults and its own readability baselines. The
     left-to-right baselines must not move.
7. **The direction travels everywhere the diagram does.**
   - JSON export and import, folder sync and share links carry the field.
   - The draw.io export writes exit/entry points for the axis.
   - The Mermaid flowchart import maps `TD`/`TB` to a top-to-bottom diagram (`BT`/`RL` fall back
     to the nearest supported direction, with a notice).
   - The assistant's IR may name a direction. Without one, it generates left-to-right as today.
8. **`direction` becomes a synchronised `doc` field in live sessions.** It is added to the
   allowlist in both relays (Node and Go). Because an old relay refuses a patch with an unknown
   field, **the relays ship first**, and the client sends the field only once the relay reports
   support for it (a capability in the session handshake). Against an older relay, the
   direction switch is disabled for the session and the field is not sent. The same
   mechanism is the path for synchronising `layoutSettings` later.

## Consequences

- (+) Vertical layouts become a first-class reading of the same model. Nothing in an existing
  diagram changes, and switching back and forth is lossless except for edge routes, which are
  re-derived anyway.
- (+) The rule that protects authors survives intact: an edge's sides come from a declaration and
  the edge, never from geometry.
- (+) Pulling side selection out of 12 node files into one function removes a class of drift
  between node types.
- (+) Mermaid `TD` imports stop silently becoming left-to-right.
- (−) **Large surface.** Every node renderer, the route readers, edge geometry, two export
  cores (app and LeanIX plugin), both relays and the share/viewer path change. Each needs its own
  test across both directions; the baseline suites double.
- (−) **Relay rollout ordering is a real constraint.** A client that sends `direction` to a relay
  that does not know it gets its patches refused. The capability gate is mandatory, not optional.
- (−) **Spacing has to be measured again for top-to-bottom.** The left-to-right numbers are tuned
  for wide cards in columns; reusing them for rows is a guess the readability counters must settle
  before it ships.
- (−) **Renaming `verticalSides` → `crossAxisSides`** touches the flowchart element descriptors
  and the handle-spec tests. The stored values (`"bottom"`/`"top"`) do not change.
- (−) **Switching direction discards hand-tuned edge routes.** This is accepted, and stated in the
  switch's confirmation.

## Rollout

This ADR is Proposed: nothing ships until it is Accepted. If accepted, the work lands as one
OpenSpec change per step:

1. The side functions and the renderer refactor, with left-to-right only and no behaviour change.
2. The field, the layout per axis, the switch operation, and the top-to-bottom baselines.
3. Exports, imports and the assistant IR.
4. The relay allowlist with the capability gate, both relays first.

When accepted, the hard rule in AGENTS.md is reworded per decision 2 in the same PR as step 2,
and `connectionDerivations.fixedSides.test.ts` gains the top-to-bottom cases.

## Amendment — 2026-10-23: accepted, and how step 2 implemented it

Accepted. Steps 1 (`handle-sides-by-direction`) and 2 (`diagram-reading-direction`) shipped.
Three points refine the decision above:

- **Decision 6 is implemented by transposition, not by parameterising each reader.**
  - A top-to-bottom layout runs the left-to-right pipeline on the graph reflected across its
    diagonal: ELK RIGHT with EAST/WEST ports, handle anchors, route alignment, straightening and
    reference scoring.
  - Boxes, routes and label centres are reflected back. The handle order is kept as is.
  - A container's header room becomes a `leftInset` in the mirror.
  - `layout/axis.ts` owns this. The route readers named in decision 6 did not change.
  - Over the reference diagrams, crossings and overlaps are identical in both directions, so
    no vertical-specific spacing was needed.
- **`verticalSides` keeps its name.** Decision 3's rename to `crossAxisSides` was not done.
  The flag now means "renders the cross axis", and the cross-axis handle ids (`source-bottom`,
  `target-top`) keep their names whatever side they sit on. Stored sides are absolute as
  decided: `sourceSide: "bottom" | "right"`, `targetSide: "top" | "left"`.
- **Until step 4, the direction switch is disabled during a live session.**

## Amendment — 2026-10-23: step 3 (interchange)

Step 3 shipped as `diagram-direction-interchange`:

- **draw.io export.** It attaches edges on the declared axis, with slot offsets along the side.
  Its normalisation rule is the left-to-right one mirrored, so left-to-right output is
  byte-identical.
- **Mermaid flowchart import.** `TD`/`TB` (and `BT`, approximated) read top-to-bottom. The
  header's direction becomes the diagram's only when the import is the whole diagram; into a
  diagram with content, the import follows that diagram, with a notice.
- **Assistant.** The IR gains an optional `direction`. An invalid value is dropped, not
  rejected, and it is honoured under the same whole-diagram rule.
- **Imports.** An imported diagram's `direction` and `layoutSettings` are sanitised.
- **draw.io import.** Still left-to-right: draw.io has no diagram-level direction to read.

