# Proposal

## Why

Using initiatives day to day still had friction: in View diagrams the initiative's new cards were
placed over existing ones; the canvas legend counted connections as elements, so it disagreed with
the pane (`+3 ~1 −1`); a new initiative was always `initiative-1`, renamed afterwards; and after a
drill-down nothing said where the diagram was opened from, or which Version it shows.

## What Changes

- **Placement by the room a card takes.** Among mostly kept siblings, `stabilizeLayout` places a new
  element clear of the room drawn cards take on the canvas (at least 260×160), not the 180×80 boxes
  the engine is given; the flow gap counts from that room, and a panel grows to hold the room of the
  cards placed in it. Synced to the plugin and the VS Code extension.
- **Legend counts like an initiative.** The changes view's legend counts elements added, changed
  and removed, and connections apart ("3 added · 1 changed · 1 removed · 5 connections").
- **A new initiative is named first.** New initiative in the pane asks for a name, shows the folder
  it makes (`initiatives/<slug>/`, numbered when taken) and opens the new initiative's detail.
- **Breadcrumb and Version in the header.** The diagrams drilled down through are crumbs before the
  diagram's name — each opens that diagram again — and the Version the canvas shows is a chip
  beside the name.
- `fallow:check` passes again (unused exports dropped; `canvasIdOf` covered by a test).

## Impact

- Host: `stable-layout.ts`, `version.utils.ts` (`countVersionChanges`), `VersionChangesLegend`,
  `DiagramTitle`, workspace page (`handleDrillUpTo`), i18n.
- opscr plugin: `initiativeFolderName`, `useInitiatives.create(title)`, `InitiativesTab` form;
  e2e `initiatives.mjs` checks the container diagram overlaps nothing, the breadcrumb, and a named
  initiative.
