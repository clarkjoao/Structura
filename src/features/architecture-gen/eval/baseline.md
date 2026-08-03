# Diagram quality baseline

Measured at slice 0. `legacy` is the hand-placed-coordinate path (what the model did
when `add_node` took an x/y); `engine` is the layout engine. Both are measured with the
same metrics and the same text measurement, so the difference is layout, not sizing.

Lower is better for every metric except grid alignment.

## Summary (mean across cases)

| Metric | Legacy | Engine |
| --- | ---: | ---: |
| Readability score | 0.99 | 1.58 |
| Edges through a node | 0 | 0 |
| Edge crossings | 0 | 0 |
| Overlap area (px²) | 0 | 0 |
| Overlapping pairs | 0 | 0 |
| Validation errors | 2.4 | 0 |
| Validation warnings | 3.8 | 0 |
| Grid alignment (%) | 100 | 100 |

## Per case

| Case | Legacy score | Engine score | Legacy overlaps | Engine overlaps |
| --- | ---: | ---: | ---: | ---: |
| C4 context — e-commerce | 0.8 | 1.82 | 0 | 0 |
| C4 container — checkout | 1.0308131845707604 | 1.6600000000000001 | 0 | 0 |
| AWS — request-driven API | 1.2324880949681338 | 1.12 | 0 | 0 |
| AWS — event-driven fan-out | 1.3 | 2.46 | 0 | 0 |
| C4 container — with trust boundary | 0.6 | 0.84 | 0 | 0 |

## Reading these numbers honestly

The legacy fixtures are hand-authored small diagrams that a careful person laid out on a
grid, so on these cases they are already free of overlaps and crossings. They are the
*good* case for the old path, not a strawman — which is the point: a baseline that
flatters the new code proves nothing.

So the readability score does **not** favour the engine here. It is dominated by total
edge length, and the engine deliberately spaces tiers further apart than these fixtures
do. A tighter diagram scores lower while being no easier to read.

What the engine does win on this set is **validation warnings** (mean 3.8 -> 0.2): the
hand-placed diagrams routinely leave labels too close to nodes and arrows without
clearance, because nothing was checking. That is the honest claim at slice 0.

The layout advantage should show up as cases get denser — hand placement degrades with
node count while the engine does not. That is not demonstrated here, and should not be
claimed until the slice 1-3 cases (generated from real requests rather than authored by
hand) are measured.

## How to use this

Later slices must not regress the `engine` column. Watch warnings and overlaps as the
primary signals; treat the readability score as a tiebreaker between layouts of the same
diagram, not as a cross-diagram quality measure.
