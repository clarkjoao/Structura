# Tasks

## 1. Dependencies

- [x] 1.1 Install `html-to-image` and `gif.js` via `npm install` and verify `npm run typecheck` passes
- [x] 1.2 Verify `npm run lint` and `npm run test` still pass with the new deps

## 2. SVG Export

- [x] 2.1 Create `src/lib/export-service/export-svg.ts` with an `exportSvg(diagram, framing, reactFlowInstance)` function that uses `html-to-image`'s `toSvg` on the React Flow pane; verify by exporting a diagram manually and inspecting the SVG file
- [x] 2.2 Add `"svg"` to the `DiagramExportFormat` union and wire `exportSvg` into `buildDiagramExportFiles`; verify the type gate passes and existing export tests still green

## 3. PNG Export

- [x] 3.1 Create `src/lib/export-service/export-png.ts` with an `exportPng(diagram, framing, reactFlowInstance)` function that converts SVG to `<canvas>` and calls `toBlob("image/png")`; apply the 4096px width cap for full-diagram
- [x] 3.2 Wire `"png"` into `buildDiagramExportFiles` and update download utilities to handle Blobs; verify PNG exports from both viewport and full-diagram modes

## 4. GIF Export (FLOW)

- [x] 4.1 Implement `useFlowPlaybackRecorder.ts` in `src/features/canvas/flow/` — drives playback via `useFlowMode` (play / goNext / chooseBranch / exitPlay), captures frames with `html-to-image` `toPng` at a configurable interval, and feeds them to `gif.js`; verify the hook produces a Blob for a 3-step flow
- [x] 4.2 ~~Add `"gif"` to `DiagramExportFormat`~~ — dropped: GIF stays in the Flow Panel (see design §3); the export service cannot drive playback

## 5. ExportModal UI

- [x] 5.1 Add SVG and PNG format cards with viewport/full-diagram radio toggle to `ExportModal.tsx`; verify the modal shows the new options and i18n keys resolve in both en and pt-BR
- [x] 5.2 Add "Record GIF" action to FlowPanel dropdown (conditional on hasFlows) — uses `useFlowPlaybackRecorder` hook to drive playback, capture frames, and produce a downloadable GIF Blob
- [x] 5.3 Add all new i18n keys to `en.json` and `pt-BR.json` under the `export.*` and `flows.*` hierarchies

## 6. Tests and Verification

- [x] 6.1 Add unit tests for `exportSvg` and `exportPng` (mock `html-to-image`); verify they pass with `npm run test`
- [ ] 6.2 Add a Cypress smoke test that opens the Export modal, selects SVG and PNG, and confirms the download filenames
- [x] 6.3 Run `npm run format:check`, `npm run lint`, `npm run typecheck`, and `npm run test`; confirm all green
