# Tasks

## 1. Settings

- [x] 1.1 `references`, `refNeighborColumns`, `refMinKeep` and `refForward` in `DiagramLayoutSettings`. `referenceRules` resolves the defaults; normalisation clamps, drops defaults and drops unknown values; `sameLayoutSettings` compares them.

## 2. Rules

- [x] 2.1 `layout/ruleRefs.ts`: `columnsOf` counts occupied columns, and `planRuleRefs` applies the far-back, forward, per-container and minimum-kept rules, per consumer.
- [x] 2.2 `planDiagramAutoLayout` picks rules, trial or off from the settings. Rules use two ELK runs, measuring without references; `ruleRefStats` is on the plan.

## 3. Editor

- [x] 3.1 The Arrange menu's Advanced section gets the References mode, the neighbour distance and minimum-kept sliders, and the forward checkbox. "Reset gaps" keeps the mode and references.
- [x] 3.2 The success toast describes what the rules did. Strings are in en and pt-BR.

## 4. Verification

- [x] 4.1 Unit tests:
  - the rules, over hand-placed layouts (`ruleRefs.test.ts`);
  - settings normalisation;
  - the planner with real ELK, in LR and TB, writing and reusing the reference;
  - the Arrange menu.
- [x] 4.2 The rules measured on the `perf:large` fixture and the 1,000-node test diagram, with occupied columns. Results are in `RELATORIO-REFS.md`, Part 3.
- [x] 4.3 Typecheck, lint, format, fallow, the full unit suite and `openspec validate --strict`.

## 5. Compact automatic references

- [x] 5.1 `AUTO_REF_W`/`AUTO_REF_H`: planned at that size (`autoRefOptionsFor`), written by `reconcileAutoRefs`, also for an existing reference.
- [x] 5.2 `SharedRefNode` draws an automatic reference as a pill; a user's reference keeps the card.
- [x] 5.3 Tests: the store size and the two drawings.

## 6. Sources start the reading

- [x] 6.1 `LayoutNode.firstLayer` → ELK `layerConstraint=FIRST`; `withSourcesFirst` in `planDiagramAutoLayout`.
- [x] 6.2 Tests: which nodes are pinned (containers included) and a source in the first column under real ELK.
