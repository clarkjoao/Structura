# Proposal

## Why

With a product workspace the pane still reads as one undivided picture. The Diagram picker does not
say which views an initiative touches. Every initiative is a Version in every diagram bound to the
folder, even a View it leaves alone, where its Version is the base again. And the Initiatives tab
only shows a status and Promote: an initiative can be seen and managed only from the Versions panel.

## What Changes

- **Versions only where the initiative changes something.** A View diagram (and the bound diagram
  while it shows a View) gets an initiative's Version only when the initiative changes what that
  View shows: `resolveView` on the root against `resolveView` on the root with the initiative
  applied (elements added, changed or moved to another box, retired, edges). The whole workspace
  keeps every initiative. A Version whose initiative stops changing the View is removed; its edits
  are in the initiative's files already.
- **Overview: what is shown, in two choices.** "Showing" picks the root (AS-IS) or an initiative's
  Version on the bound diagram; an initiative that changes nothing in the current View is disabled.
  The Diagram select becomes a list of the whole workspace and the Views, each marked with the
  initiatives that change it and how much (`+3 ~1 −1`); a mark shows that View with that initiative.
  The boxes that open another view fold under their summary.
- **Initiatives tab: list and detail.** The list shows each initiative's status, its counts, the
  number of Views it changes, lock issues, whether it is on the canvas, and New initiative. The
  detail edits the name, status and description (written to the `Initiative` manifest, unsaved
  until Save), links its docs (`metadata.links.docs`), shows it on the canvas or goes back to the
  root, lists its changes (each one shown and lit on the canvas), the Views it changes (each opens
  that View with the initiative), its files (each opens in Files), lock issues with Accept root, and
  offers Promote… (the preview) and Delete (confirmed in place; the folder goes on Save).

## Impact

- opscr plugin only: `engine/initiatives.ts` (`initiativeViewChanges`, Versions per View),
  `useInitiatives` (rows with changes and files; show, locate, create, remove, set a field), new
  `InitiativesTab`, `ViewPicker` and `InitiativeBits`, `OpscrPane`, i18n.
- The e2e scripts pick Views from the list; `initiatives.mjs` checks the marks, Showing, the
  detail, and that only the View diagrams the initiative changes have its Version.
