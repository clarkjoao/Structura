# Proposal

## Why

The app currently exports diagrams as JSON, Draw.io XML, and Mermaid markdown. Users have no way to get a visual snapshot (SVG/PNG) or an animated walkthrough of a FLOW (GIF) — formats needed for documentation, presentations, and sharing with stakeholders who don't use Structura.

## What Changes

- Add **SVG** and **PNG** as new export formats in the Export modal, with a viewport/full-diagram toggle per format.
- Add **GIF** as a FLOW-specific export, triggered from the Flow Panel, that records an automated playback of the flow, step by step.
- Introduce two new npm dependencies: `html-to-image` for raster capture and `gif.js` for GIF encoding.
- New UI strings for both locales (en + pt-BR).
- No breaking changes to existing exports or data model.

## Capabilities

### New Capabilities

- `diagram-visual-export`: owning the requirements for SVG, PNG, and GIF export — framing options, file output, and FLOW playback recording behavior.

## Impact

- **UI:** ExportModal gains two new format cards (SVG, PNG) with a viewport/full-diagram toggle. The Flow Panel gains a "Record GIF" action with speed control (slow / normal / fast).
- **Service layer:** `src/lib/export-service/` gains SVG/PNG exporters (DOM capture). GIF stays out of the service layer because it drives live playback.
- **Flow integration:** `src/features/canvas/flow/` provides a playback-recording hook that steps through the flow programmatically and captures frames.
- **Dependencies:** `html-to-image`, `gif.js`.
- **i18n:** new keys under `export.*` for both `en.json` and `pt-BR.json`.
