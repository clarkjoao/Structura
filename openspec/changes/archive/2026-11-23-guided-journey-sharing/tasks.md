# Tasks

## 1. Document

- [x] 1.1 Add `guided.document.ts` and the "Document (Markdown)" format, plus the download action in the Text panel. Verify: unit tests for the two-phase scenario (headings, decisions, back jumps, lanes and participants), and a panel test for the download.

## 2. Present by phase

- [x] 2.1 Derive one flow per phase (create, update, remove, read-only in the flow panel). Verify: harness tests for a new phase, a rename, a removed phase, and an exit leaving the phase.
- [x] 2.2 Add "Present by phase" in the mode bar: upsert the walkthrough by its marker and open the player. Verify: a test for creating it and then updating it on a second run, with scene labels.

## 3. Review presets

- [x] 3.1 Add the "Review journey" menu with four i18n presets that open the chat and send. Verify: a component test showing the chat opens and `sendMessage` gets the preset text; hidden without a connection.

## 4. Templates

- [x] 4.1 Add `templates` to the contract, three guided templates (en and pt-BR outlines), and the creation dialog choice with "Paste meeting notes". Verify: tests showing each template builds without errors and with one undo, and a dialog test for "Paste meeting notes" opening the assistant.

## 5. Wrap-up

- [x] 5.1 Add the docs and a Cypress scratch tour: create from Checkout, copy as Document, present by phase, review with a stubbed assistant. Run `openspec validate`, vitest, typecheck, lint, fallow and prettier. Verify: all pass.
