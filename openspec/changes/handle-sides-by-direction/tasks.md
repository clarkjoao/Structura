# Tasks

## 1. Side model

- [x] 1.1 Add `nodes/node-types/handle-sides.ts` (`ReadingDirection`, `DEFAULT_READING_DIRECTION`, `HandleSides`, `handleSides`, `isHorizontalSide`). Verify with unit tests for both directions.
- [x] 1.2 Add `contexts/ReadingDirectionContext.tsx` with an `"LR"` default and `useHandleSides()`. Verify with a hook test: no provider gives LR, a `"TB"` provider gives top/bottom.

## 2. Builders

- [x] 2.1 Make `buildHandles` and `bundleDot` place slots along the side's axis (`top` for left/right, `left` for top/bottom), with `handleTopCss` keeping its name. Verify with tests: LR output is identical to before, and TB spreads along `left`.
- [x] 2.2 Change `SkinHandles` to take `input`/`output` points and sides from `useHandleSides()`, and update its callers. Verify with typecheck and the existing skin tests.

## 3. Renderers

- [x] 3.1 Switch CardNode, PanelNode, DeployParts, NoteNode, DbTableNode, JsonViewerNode, EndpointNode, ExternalElementNode and SvgNode to `useHandleSides()`. Verify that the node test suites pass unchanged.
- [x] 3.2 Switch ProcessNode, indexing its anchor points by side for the main and cross axes. Verify that the flowchart and `connectionDerivations.fixedSides` tests pass.
- [x] 3.3 Add a guard test: no file under `nodes/` other than `handle-sides.ts` names `Position.Left|Right|Top|Bottom`. Verify that it passes now and fails if one is reintroduced.

## 4. Integration checks

- [x] 4.1 Run `npm run typecheck`, `npm run lint`, `npm run test` and `npm run fallow:check`. Verify all of them are green.
- [x] 4.2 Check in `npm run dev` that handles, bundle dots and flowchart top/bottom handles look and connect as before.
