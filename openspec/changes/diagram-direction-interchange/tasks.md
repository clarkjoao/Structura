# Tasks

## 1. draw.io export

- [x] 1.1 Make `edgeSides` direction-aware and generalise `mapEdge`'s slot normalisation as designed; pass `diagram.direction` through `diagramToExportModel`. Verify that the golden and drawio suites are unchanged and that a TB test exits bottom/enters top with slot offsets along x.

## 2. Import sanitising

- [x] 2.1 Sanitise `direction` and `layoutSettings` in `normalizeImportedDiagram`. Verify with a test: valid values kept, invalid ones dropped.

## 3. Mermaid flowchart

- [x] 3.1 Return `direction` and `directionApproximated` from `parseMermaidFlowchart`. Verify with parser tests for LR/TD/TB/BT/RL.
- [x] 3.2 Give `layoutScopedNodes` `writeDirection`, and wire FlowPanel's target-direction rule and notices (en/pt-BR). Verify with a `layoutScopedNodes` test that writes the direction in one undo step, and with the i18n parity test.

## 4. Assistant IR

- [x] 4.1 Add `direction` to the IR types, validator and prompt schema. Verify with validator tests (kept, dropped) and a prompt test.
- [x] 4.2 Make `applyIRToDiagram` and `autoLayoutActiveDiagram` direction-aware. Verify with an apply-ir test: TB into an empty diagram sets the direction and lays out downward.

## 5. Docs and checks

- [x] 5.1 Update `docs/features.md` (export/import notes) and ADR-0013 (step 3 done). Verify by review.
- [x] 5.2 Run `npm run typecheck`, `npm run lint`, `npm run test` and `npm run fallow:check`. Verify all of them are green.
