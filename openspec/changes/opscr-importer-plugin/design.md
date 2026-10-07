# Design

## Context

- A plugin is a Vite IIFE bundle with no `@` alias that cannot import the host; it receives the plugin
  API types through `sync-types` and shared host code through `sync-shared` (ADR-0009).
- `opscr/core` is ESM, browser-safe, ~370 KB with its schemas; it is available locally via `npm link`.
- The host's ELK layout (`features/canvas/layout/layoutEngine.ts`) is not reachable from a plugin, and
  the plugin API has no layout call.

## Goals / Non-Goals

**Goals:**

- The plugin owns only glue: parse → project → lay out → convert to `ImportResult`.

**Non-Goals:**

- A layout API on the plugin surface: one importer does not justify it; the VSCode preview will tell
  whether a shared layout module is worth extracting.

## Decisions

**Bundle `opscr/core` and `elkjs` into the plugin IIFE.** Both are self-contained and run in the
browser. The plugin build fails loudly when `opscr` is not linked, and it is not part of CI.

**Copy `src/lib/opscr-mapping` with `sync-shared`** into `src/generated/opscr-mapping`, tests and
fixtures excluded, with a `--check` mode — the same mechanism as LeanIX and `export-core`.

**Plugin-local ELK runner, same options as the host.** Builds the ELK graph from the view's layout
graph (sorted by id for determinism, `INCLUDE_CHILDREN`, layered left-to-right) and reads back boxes
only. The options mirror `ELK_OPTIONS_INTERACTIVE` with a comment pointing at it; they are a dozen
constants, and copying them is cheaper than a shared module with one consumer.

**Conversion.** Node key = view id (`Kind/name`); `parentKey` = view parent; roots offset by
`ctx.anchor`; panels pass their fitted `width`/`height`, leaves keep their intrinsic size (as the LLM
generator does); catalog components pass `type`, `cloudServiceId` (from `catalogServiceId`) and
`technology`; connections are labelled with the opscr edge type.

**Warnings.** One line per opscr error (first ten, then a count), one line summarising omitted Kinds,
one summarising dropped edges.

## Risks / Trade-offs

- [ELK options drift from the host's] → a comment names the source; layout is cosmetic here and the
  user can run the canvas auto-layout afterwards.
- [Bundle size (~1.5 MB with ELK)] → only loaded when the user installs the plugin.
