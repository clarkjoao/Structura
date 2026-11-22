## Context

- **Arrangement.** The guided arrangement (`guided.arrange.ts`) runs a longest-path layering of the step graph, back-edges left out. It derives columns from the layers and lane bands from the lanes. It is deterministic and runs after every structural edit and every `arrangeKey` change.
- **Part 2** adds two things this change builds on:
  - `kindProps` on components;
  - experience scores, with `KindMarker.badge`.
- **Overlays.** The canvas already draws viewport-anchored layers, such as shared-element and presence layers, through React Flow's `ViewportPortal`.

## Decisions

### 1. Phase starts on steps, not a phase list in `kindData`

`kindProps.phase` on the step where a phase begins. Phase membership is derived:

- `phaseOf(step)` is the step's own start, if it has one;
- otherwise it is the latest phase among its forward predecessors, in reading order of starts.

A single forward walk in the layering's topological order computes it.

The alternative was a `kindData.phases` list plus a phase id on every step. It was rejected because two sources must agree:

- deleting a phase's last step leaves an empty phase;
- adding a step needs its phase chosen;
- pasting from another diagram dangles ids.

Starts read like the way people write journeys ("from here on we are in _Buy_"). They also map one-to-one to `## Buy` and to Mermaid `section`.

### 2. The arrangement takes phase floors

The layering gains one rule: the layer of a phase-p step is at least `floor[p]`, where `floor[p]` is one more than the largest layer of any step in an earlier phase.

Floors depend on layers and layers depend on floors, so the arrangement relaxes. It repeats layering with the current floors and recomputing the floors, until nothing changes. The work is bounded:

- floors only grow;
- they are capped by the step count;
- in practice two or three passes are enough.

Determinism holds, because each pass is deterministic. `guidedArrangeKey` adds the phase starts, so renaming a phase or moving its start re-arranges the diagram.

The band needs room. When a phase exists, the lanes start `PHASE_BAND` (56 px) further along the cross axis. That is below the band on LR diagrams, and right of it on TB diagrams. This uses the same "bands start where the lanes already start" rule, so the diagram does not jump on later edits.

### 3. A generic overlay, drawn by the host

The kind contract gains:

```ts
overlay?: (diagram: DiagramModel) => KindOverlay | null;
KindOverlay = {
  bands: Array<{ id; label: string; from: number; to: number; selects?: string }>;
  axis: "x" | "y";
  /** Where the band sits across the axis, and its depth. */
  at: number;
  depth: number;
  separators: number[];
  curve?: Array<{ along: number; value: number /* 0..1 */; tone: "danger" | "neutral" | "success" }>;
}
```

All coordinates are in flow space. The kind computes them from the stored layouts after arranging; `getCachedCanvasSnapshot` keeps this cheap.

`KindOverlayLayer` draws them inside a `ViewportPortal`:

- an SVG with the header segments (`foreignObject`-free text, for export-safe rendering);
- dashed separators spanning the lanes' cross extent;
- the curve, as a polyline plus dots.

Segment clicks call `onSelectElement(selects)`. It is memoised on the snapshot, like `kindMarkersFor`, and drawn only when the kind is active and the canvas is editable or in a live session view. Read-only viewers skip it, as they skip markers.

The alternative was making the bands real components (panels). It was rejected because they would be selectable, exportable and synced as elements, would interfere with lane parenting, and would have to satisfy conformance.

### 4. The curve

The curve walks the main path (each decision's first exit, the same path as the Mermaid journey export) and keeps the scored steps. `along` is the step's column centre in absolute coordinates, and `value = (score - 1) / 4`.

The band reserves the lower 60 % of its depth for the curve when any score exists, and puts the labels on top.

### 5. Text and Mermaid

- **Outline.** The tokenizer recognises `^##\s+(.+)$` (before the comment check, since `#` starts a comment) as a phase token. It attaches `phase` to the next item, through `OutlineNode.phase`. The builder writes it to `add[].kindProps`, merged with `experience`. The serializer emits `## Name` before a start, at the current indentation.
- **Mermaid journey.** A section sets a pending phase that the next task takes. The export walks the main path and writes `section` whenever `phaseOf` changes.
- **Swimlane.** `%% phases:` works the same way as part 2's `%% experience:`. Both are read in the meaningful-lines pass before `%%` lines are dropped.

### 6. Inspector

The Phase section is a `labels` section with one item:

- its title is "Start a phase here";
- its placeholder is the current phase ("In: Buy", or "No phase");
- committing calls `guidedSetPhaseStart(diagram, stepId, name | null)`, which merges `kindProps`.

## Risks

- **Relaxation cost on large journeys.** Mitigation: phases are few, and floors converge in at most `phases + 1` passes. There is a test on a 300-step journey with 6 phases.
- **The band shifts the lanes** when the first phase is created. This is a one-time move, documented in the spec scenario. Later edits keep the band.
- **The overlay is not exported to PNG/SVG** in this change; the export takes elements only. A follow-up can add it.
