# Assisted diagram generation, via an intermediate representation

Generates a whole C4 or AWS diagram from a sentence in the chat. The model
returns a JSON document — the IR — which is validated, laid out with ELK and
applied to the canvas. Nothing about the existing incremental patch chat changes.

Try it: open the assistant and type `/generate C4 container diagram for an
e-commerce with microservices` (`/gerar` also works).

---

## What is in here

**The pipeline** — `src/features/llm/ir/`

- `ir.types.ts` — the schema: diagram type, `semanticType`/`tier` enums,
  `parentId` containment, `isBoundary`, `awsService`.
- `ir-validator.ts` — parses a raw model reply (bare JSON, fenced, or wrapped in
  prose) and collects _every_ schema problem rather than stopping at the first:
  unique ids, edge endpoints, parent references, containment cycles.
- `ir-prompt.ts` — the generator prompt. Reuses the app's own AWS catalog, so
  the service ids it teaches are the ids the canvas resolves.
- `apply-ir.ts` / `generated-graph.slice.ts` — writes the whole graph in one
  store mutation, so a generation is one undo step rather than one per node.
- `irLayoutEngine.ts` — ELK layout for the IR.

**Measurement** — `src/features/canvas/layout/`

- `layoutReadability.ts` — counts edge crossings, edges passing over nodes and
  overlapping labels. This is the instrument the layout config is tuned against.
- `renderedEdgePath.ts` — the same counts over the path the canvas _actually_
  draws, which is not ELK's.
- `reference-diagrams.ts` + `hand-placed-diagram.ts` — five fixtures with
  recorded baselines, guarded by `layoutReadability.baseline.test.ts`.

Rendered crossings across the four generated fixtures went **52 → 12**.

---

## Behaviour changes for people already using Structura

These affect existing diagrams, not just generated ones. Worth a look before
merging.

| Change                                            | Effect                                                                                                                                                                                                                                     | Where                                                |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| **Edge side is now derived from position**        | Every edge in every diagram. An edge to a node further left used to leave the right side and loop around; it now leaves the left. Flips only when the target is _entirely_ left of the source, so a pixel of movement cannot oscillate it. | `connectionDerivations.ts`, `CustomNode/Handles.tsx` |
| **`technology` shows on cloud nodes**             | AWS/GCP/Azure nodes with a `technology` value now display it instead of the category name. Nodes without one are unchanged — the category fallback still applies.                                                                          | `c4.descriptor.ts`                                   |
| **Panel headers stop repeating the kind**         | "VPC - VPC" becomes "VPC"; "Availability Zone - AZ us-east-1a" becomes "AZ us-east-1a". A name that does not mention its kind still gets the prefix.                                                                                       | `panelLabel.ts`                                      |
| **Auto-layout waypoints land in the right place** | Bug fix. Running auto-layout on a diagram with panels used to offset the control points of every edge between two siblings by the panel's position.                                                                                        | `autoLayoutEngine.ts`                                |
| **`cy.dragNode` actually drags**                  | Test-only. It fired pointer events, which React Flow ignores, so the two stress drag tests passed while moving nothing.                                                                                                                    | `cypress/support/commands.ts`                        |

New handle ids only appear for the mirrored sides (`source-l-*`, `target-r-*`);
the default sides keep their original ids, so recorded walkthrough steps — which
store a `handleId` for highlighting — still resolve.

---

## Behind a flag, off by default

`ir-layout-flags.ts`

- **`applyElkWaypoints` — off.** Feeding ELK's bend points to generated
  connections was measured: edges over nodes 15 → 1, but crossings unchanged
  (52 → 53) and labels worse (3 → 7). The blocker is staleness: moving a node
  does not update the stored points, and the edge then detours through the old
  corridor. Adopting needs invalidation-on-move first.
- **`applyElkHandleOrder` — on.** Kept switchable for comparison only.

---

## Debt and open questions, deliberately not addressed

1. **The legacy auto-layout still disagrees with the canvas about handle
   geometry.** `buildPortsForNode` tells ELK the handles are at
   `(slot + 0.5) / MAX_HANDLES` and always EAST→WEST; the canvas renders
   `(i + 1) / (n + 1)` and now picks the side from the geometry. Reconciling
   properly means the engine consuming `buildEdgeHandleAssignments` instead of
   reimplementing it — a real refactor of a shared file. A partial attempt made
   the measured mismatch _worse_ (avg 4.0 → 17.2px) and was reverted. Current
   mismatch on a fan-out fixture: avg 4.0px, worst 14.7px.
2. **Tier does nothing.** The `tier` field is filled and carried to the canvas,
   but no mechanism acts on it, and there is **no known failure case** that would
   say which mechanism is needed. Producing such a case is the prerequisite.
3. **Domain rules for C4 and AWS are not implemented.** No completeness or
   hierarchy enforcement. Deferred because the model has produced structurally
   correct diagrams without it so far.
4. **No repair loop.** An invalid IR is explained to the user in the chat; there
   is no retry.
5. **`§9` targets are stale.** Completeness and schema-validity numbers come from
   a pre-spec measurement whose instrument was later found faulty. Marked pending
   recalibration in the spec; only the readability rows have numbers measured
   against this code.
6. **Reference diagrams are reconstructions.** The IR of the generations that
   were originally reviewed was not kept. The chat now has a download button so
   future fixtures come from real runs.

---

## Where a reviewer should look hardest

- **`connectionDerivations.ts`** — the side/slot decision. It touches every edge
  in the product, and the per-side counting is the subtle part.
- **`layoutReadability.ts` `walkGraph`** — the lowest-common-ancestor correction.
  ELK reports an edge relative to the LCA of its endpoints, not to the array
  holding it. Getting this wrong is silent and was the cause of the auto-layout
  waypoint bug.
- **`generated-graph.slice.ts`** — the only new store slice. One mutation, one
  history entry.
- **`ir-validator.ts`** — specifically the boundary rule, which was relaxed after
  a real generation was rejected over it.

---

## Checks

- `npm run typecheck`, `npm run test` (680), `npm run build` all clean.
- Cypress: `ir-generation-smoke` (15) and `node-drag-smoke` (2) pass.
- `npm run lint` and `npm run format:check` report exactly what they report on
  `main` — 74 lint problems and 90 unformatted files, none of them from this
  branch. Verified by stashing the branch and re-running both. Deliberately
  untouched.
- This file is PR metadata, not code; delete it once the PR is open.
