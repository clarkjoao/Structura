# Tasks

## 1. Per-element kind data

- [x] 1.1 Add `kindProps` to `BaseComponent`, an `isKindProps` validator (JSON, depth, 4 096-character cap) in `diagram-kind.ts`, and sanitizing on import. Verify: unit tests for valid, oversized and non-object values, and an import test that drops an invalid value.
- [x] 1.2 Add `kindProps` to `KindNodeInput` and `KindEdit.update` (with `null` to clear), applied in `kind.slice.ts`. Verify: slice tests for set, replace, clear and undo, and that copy-paste and freehand mode keep it.

## 2. Guided score

- [x] 2.1 Add `experienceOf` and `guidedSetExperience`, and the "Experience" choice section in `guided.inspector.ts`. Verify: harness tests for set, clear and undo, and a component test for the section.
- [x] 2.2 Add `KindMarker.badge` and draw it on the process node in kind mode. Emit the `experience` and `painPoint` markers from `guidedChecks`. Verify: a checks unit test (tone by score) and a node render test for the badge, with nothing in freehand mode.
- [x] 2.3 Add `focusMarkers` to the descriptor and the pain-points chip in `KindModeBar`, which cycles the selection in reading order. Verify: a component test for the count, plural forms and cycling.

## 3. Text and Mermaid

- [x] 3.1 Outline `[n]`: parse it (with the `experienceOutOfRange` error), escape it, build it into `kindProps`, and serialize it. Verify: outline tests for parse, build, serialize and a round trip with scores.
- [x] 3.2 Mermaid: store journey import scores and write them on journey export; add the swimlane `%% experience:` export comment and read it on import. Verify: journey and swimlane round-trip tests keep the scores, and the summary no longer counts scores as set aside.
- [x] 3.3 Assistant: document `[n]` in the guided prompt section. Verify: a prompt test showing the current journey carries `[2]`.

## 4. Wrap-up

- [x] 4.1 Add the en/pt-BR keys (section, marker, chip plurals, error), extend `i18n-coverage.test.ts`, and update `docs/concepts/diagram-kinds.md` (`kindProps`, badges, the score syntax). Verify: the coverage test passes.
- [x] 4.2 Add a Cypress scratch tour: score two steps from the Journey tab, check the badges and the chip, cycle the chip, paste the Mermaid "My working day" and check that "Do work" shows a red 1. Then run `openspec validate`, vitest, typecheck, lint, fallow and prettier. Verify: all pass.
