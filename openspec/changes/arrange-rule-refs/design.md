# Design

## Decision 1 — Columns are counted, not measured

"Neighbour" means how many columns of elements a connection spans, not a distance in pixels.

`columnsOf` takes the leaves along the reading axis and starts a new column whenever one sits more
than half a typical leaf width past where the current column began. Containers are left out,
because they span what they hold.

A distance-based pitch (typical width + layer gap) was tried first and rejected. ELK gives every
labelled connection a layer of its own, so a five-element cycle measured more than six "columns"
back.

## Decision 2 — Measured on a layout without references

The rules read the arrangement as it would be without automatic references. Earlier automatic
references are folded back first (`withoutAutoRefs`), so a run does not read its own previous
result. The rules then decide, and the diagram is laid out again with the references.

That is two ELK runs, against up to 19 for the trials. The layout applied is the one laid out with
the references, so what is drawn is what was planned.

A top-to-bottom diagram runs the same rules on the mirrored graph (`axis.ts`), as every other
layout reader does.

## Decision 3 — Decided per consumer

`reconcileAutoRefs` moves every connection from a consumer to the original onto the reference
together. The rules therefore decide per consumer as well: a consumer moves only when all of its
connections to the original are ones a rule moves.

The minimum kept on the original counts every connection the original has, incoming and outgoing.
When the rules would leave it with fewer than `refMinKeep`, the closest consumers stay. The closest
are the ones that read best as lines.

## Decision 4 — Near back-connections stay back-edges

A back-connection within the neighbour distance is left as the layout draws it. This is the short
back-edge ADR-0013 requires: it leaves its source on the output side and enters its target on the
input side.

Drawing it with the arrow reversed would flip a side or swap the connection's ends, and ADR-0013
rules out both. The user chose to keep it as a back-edge.

## Decision 5 — Rules are the default; the trials stay as `auto`

Absent `references` means `rules`, so a diagram that stores no settings still stores nothing. The
trial mode keeps its own budget (`AUTO_REF_TRIAL_BUDGET`) unchanged. `off` makes no references and
removes the ones an earlier arrangement made.

## Decision 6 — An automatic reference is a compact pill

An automatic reference is drawn as a pill (`AUTO_REF_W` × `AUTO_REF_H`, 160 × 40): the link glyph
and the original's name, no `ref` chip, a lighter dashed border. The layout plans at that size and
`reconcileAutoRefs` writes it, so a reference an earlier version made larger shrinks on the next
run. A reference the user made keeps the card. Measured with the rules on the two diagrams: same
crossings (−2% / −1%), canvas area −19% / −5%.

ELK option changes to bring panels that talk closer (thoroughness, hierarchical sweepiness,
greedy-switch, network-simplex placement) were measured and left out: at most −6% crossings, and
network-simplex took 80–340 s.

## Decision 7 — An element nothing enters starts its container

The whole-diagram arrangement pins every element no connection enters (a container: none from
outside) to the first layer of its container (`sourcesFirst.ts`, ELK's `layerConstraint=FIRST`), so
the diagram grows right, or down in TB, from its sources. Computed before references are made.
Always on: measured with references by rules, sources outside the first column went 49 → 5 and
158 → 0, at +6% / +3% crossings and +13% / +22% length.

## Risks

- **More boxes.** A large diagram gets one reference pill per far back-connection, about 130–180 on
  the measured diagrams. The score does not penalise boxes; the user judges whether they read
  better.
- **Few groups.** On the generated diagrams, about 98% of the references stand for one connection.
  Real diagrams, where a whole panel calls back the same store, should group more.
- **Behaviour change.** Arranging a diagram with cycles or containers now makes references where it
  did not before. Undo restores the previous arrangement, and `off` turns references off for good.
