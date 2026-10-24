# Proposal

## Why

The moonshot of the opscr integration: edit `.opscr.yaml` in VSCode and see the diagram live. In
VSCode the YAML is changed by the user or, more and more, by Claude Code writing whole files — so the
diagram there is a view (decided 2026-10-08, after a first cut that made it editable): it must only
show what opscr validates, laid out automatically, and never be edited from the diagram. Diagram
editing stays the Structura platform's job.

Along the way the platform side gained two reusable pieces: an editable embed of the canvas and a
UI-free binding engine.

## What Changes

1. **VSCode preview, validated:** the preview draws only YAML that opscr validates without errors
   (warnings do not block) — typed, saved or written to disk by another tool, which it now watches.
   Meanwhile it keeps the last valid picture and the status bar says why. Layout stays automatic
   (stable layout, re-layout command, the `opscr.layout.json` sidecar). No chat.
2. **Editable embed** (`embed-editor.html`, built with the preview): the full Structura canvas on an
   in-memory diagram, driven over `postMessage` like a remote plugin API — kept for hosts that need
   an editable diagram; the extension does not use it.
3. **Binding engine**: the opscr plugin's document pane orchestration becomes `OpscrEngine`
   (`plugins/structura-plugin-opscr/src/engine/`), with ports (texts, diagram, binding, projector)
   and a `requireValid` option.

## Non-Goals

- Editing the diagram in VSCode; the chat in VSCode.

## Capabilities

### Modified Capabilities

- `opscr-preview`: the preview draws only validated YAML and follows files written to disk.

## Impact

- Extension: pipeline gating, folder watcher, status bar item, e2e. Host: `src/embed/editor/*`,
  `embed-editor.html`, `Canvas` `showChat`. Plugin: `src/engine/`.
