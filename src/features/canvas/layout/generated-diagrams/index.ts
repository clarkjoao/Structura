import type { ReferenceDiagram } from "../reference-diagrams";
import { aRun1 } from "./A-run1";
import { aRun2 } from "./A-run2";
import { aRun3 } from "./A-run3";
import { bRun1 } from "./B-run1";
import { bRun2 } from "./B-run2";
import { bRun3 } from "./B-run3";

/**
 * Six real model outputs at ~40 nodes, frozen.
 *
 * `REFERENCE_DIAGRAMS` next door are reconstructions: hand-written IR matching
 * shapes a human reviewed, all of them small and all of them tidy. These are
 * captures — the exact bytes six `/generate` runs produced in the real app on
 * 2026-08-27, ids and all, including whatever the model got wrong.
 *
 * They exist because the geometry of a generated diagram varies wildly for the
 * same prompt: Case A measured 10, 7 and 51 rendered crossings across three
 * runs, Case B 23, 99 and 83. While the IR changes on every run there is no way
 * to tell a layout regression from the model having written a different graph,
 * so nothing about edge routing can be measured at this size at all. Freezing
 * the input removes the model from the measurement.
 *
 * The ids are fixed because they are literal strings in these modules, and that
 * is load-bearing: ELK breaks placement ties on node id, so a generated id would
 * make every number here irreproducible. See
 * `docs/baseline-geracao/measure-id-sensitivity.json`.
 *
 * B-run1 is the one that carries the dropped-edge failure — 16 of its 27 edges
 * address a node that has children. Keep it.
 */
export const GENERATED_DIAGRAMS: ReferenceDiagram[] = [
  { name: "A-run1 C4 insurer", ir: aRun1 },
  { name: "A-run2 C4 insurer", ir: aRun2 },
  { name: "A-run3 C4 insurer", ir: aRun3 },
  { name: "B-run1 AWS deployment", ir: bRun1 },
  { name: "B-run2 AWS deployment", ir: bRun2 },
  { name: "B-run3 AWS deployment", ir: bRun3 },
];

export { aRun1, aRun2, aRun3, bRun1, bRun2, bRun3 };
