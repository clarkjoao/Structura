# Design

## Context

See `proposal.md` for motivation.

The app already has a rich export pipeline: `src/lib/export-service/` converts a `Diagram` into JSON, Draw.io XML, or Mermaid markdown, then downloads or zips the result. For SVG/PNG/GIF we need a different path — these formats require rasterizing or animating the _canvas rendering_, not just serializing the model.

Two existing assets are relevant:

1. **`generatePreviewSvg.ts`** (`src/lib/diagram-preview/`) — renders a diagram as a standalone SVG string without React Flow. It already computes bounds, renders every component type, and draws connections. It operates on the export model, not on DOM.
2. **`html-to-image`** (new dep) — captures DOM nodes as PNG/SVG via a browser-native pipeline (no server). Handles viewport and full-element capture with `pixelRatio` control.
3. **`gif.js`** (new dep) — encodes PNG frames into a GIF entirely client-side, using a web worker for the LZW compression.

The existing `DownloadFile` and `downloadZip` utilities handle the final user download.

## Goals / Non-Goals

**Goals:**

- SVG and PNG exports from the ExportModal, reusing existing framing logic.
- GIF export from the Flow Panel, recording automated playback.
- All exports client-side, no backend or external calls.
- i18n coverage (en + pt-BR).

**Non-Goals:**

- PDF export
- Video (MP4/WebM) export
- Custom color themes for exports (use the diagram's current appearance)
- Collaborative export (only the local diagram state is exported)

## Decisions

### 1 — SVG: DOM capture via `html-to-image` rather than re-rendering the export model

**Decision:** Use `html-to-image`'s `toSvg` on the React Flow pane DOM element for SVG export.

**Rationale:** `generatePreviewSvg.ts` produces card-style icons (simplified shapes), not the exact canvas rendering (shadows, custom node internals, edge labels). DOM capture preserves exactly what the user sees. SVG output from `html-to-image` is a faithful clone of the DOM subtree with embedded raster images for complex nodes.

**Alternative:** Re-render from the export model. Rejected because it would diverge from the canvas and require duplicating node rendering logic.

### 2 — PNG: SVG → Canvas 2D pipeline

**Decision:** PNG is derived from the SVG export: convert SVG string → `Image` blob → draw to `<canvas>` 2D → `toBlob("image/png")`.

**Rationale:** Avoids maintaining two separate rendering paths. The SVG→PNG step is a single, well-understood pipeline. Width cap (4096px on full-diagram) is applied by adjusting `pixelRatio` in the `html-to-image` call.

**Alternative:** Use `html-to-image`'s `toPng` directly. Rejected because `toPng` embeds everything as bitmap pixels; SVG gives users a vector option they can edit.

### 3 — GIF: playback recording hook + frame capture + `gif.js`

**Decision:** A new hook (`useFlowPlaybackRecorder.ts` under `src/features/canvas/flow/`) drives the flow playback programmatically through `useFlowMode` (`play`, `goNext`, `chooseBranch`, `exitPlay`). After each step transition (with the chosen speed as delay), the visible `.react-flow` canvas is rasterized with `html-to-image` (canvas chrome filtered out). Frames are encoded by `gif.js`'s default `GIF` class in a web worker (worker script imported via Vite `?url`).

GIF is exported from the Flow Panel ("Record GIF" → speed submenu), **not** from the Export modal or `buildDiagramExportFiles`: the export service is a pure diagram → files function and cannot drive React playback state. `DiagramExportFormat` therefore does not include `"gif"`.

Recording holds the camera still (`useFlowViewStore.cameraLocked` suppresses the per-step reading frame) after framing every node the flow touches once, so frames line up. The live step animation is a CSS particle on the active edge, which a still DOM capture cannot show: each step is captured once without it, and the particle is redrawn along the edge path on a 2D canvas in 40ms sub-frames (25fps). Because the recording frames the whole flow (usually zoomed out), the particle's width and dash are drawn at their reading-zoom screen size (×1.5, with a soft halo) while its spacing and speed stay the live ones, so it reads as clearly as during playback (same dash, period and direction as `flowParticle`), clipped out of edge labels.

**Rationale:** Reuses the playback engine already implemented and tested. `gif.js` is the smallest viable GIF encoder with web-worker support (avoids blocking the UI thread during encoding).

**Alternative:** Record via `MediaRecorder` API. Rejected because it captures a `<video>` stream, not individual canvas frames, and produces WebM rather than GIF — the user explicitly asked for GIF.

### 4 — Framing (viewport vs full-diagram)

**Decision:** Framing is a property of the export call, not a diagram change. For viewport, `html-to-image` captures the React Flow container at current zoom/pan. For full-diagram, we compute the bounding box of all nodes (from `toObject()`), resize the capture element to that box, and set `pixelRatio` to 1 (no zoom) capped by the 4096px width limit.

**Rationale:** Keeps the diagram state untouched. The toggle is transient UI state, persisted only in the modal's local state.

### 5 — New dependencies

**Decision:** Add `html-to-image` and `gif.js` as production dependencies.

**Rationale:** Both libraries are small, framework-agnostic, and widely used. They solve complex problems (DOM serialization, LZW encoding) that are not worth reimplementing.

**Alternative:** Implement custom SVG serialization + GIF encoder. Rejected due to complexity and maintenance burden.

### 6 — File structure

```
src/lib/export-service/
  export-svg.ts          ← SVG export via html-to-image
  export-png.ts          ← PNG export (SVG → Canvas → Blob)
  build-export-files.ts  ← MODIFIED: add svg/png to DiagramExportFormat
  download-file.ts       ← unchanged (already handles Blob downloads)

src/features/canvas/flow/
  useFlowPlaybackRecorder.ts ← NEW: playback recorder hook (GIF)
  FlowPanel.tsx              ← MODIFIED: "Record GIF" action with speed submenu

src/pages/workspace/
  ExportModal.tsx        ← MODIFIED: add SVG, PNG cards + framing toggle

src/infrastructure/i18n/locales/
  en.json               ← MODIFIED: new export.* keys
  pt-BR.json            ← MODIFIED: new export.* keys
```

## Risks / Trade-offs

**[Large diagram GIF memory]** → Mitigation: cap GIF dimensions at 4096px width; offer Slow/Normal/Fast so users can trade quality for size.

**[html-to-image with custom React nodes]** → Some node types render via `<foreignObject>` or canvas; these may not serialize cleanly. Mitigation: test with all built-in element families; fall back to viewport-only for problematic types.

**[gif.js web worker bundling]** → Vite needs the worker imported correctly. Mitigation: import `gif.js/dist/gif.worker.js?url` and pass it as `workerScript`.

**[i18n coverage gaps]** → New strings added outside `export.*` keys will fail CI. Mitigation: run `npm run lint` (which includes i18n checks) during implementation.
