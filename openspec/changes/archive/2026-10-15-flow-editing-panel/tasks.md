## 1. The flows panel stops editing

- [x] 1.1 Remove the script from inside the flows list per design D1, leaving the card to select; verify the existing panel test is rewritten to assert the opposite — that no step field and no key of the running object is reachable from the list.
- [x] 1.2 Turn the chevron into a mark that says which flow the canvas is numbered from, per design D2, keeping the click and the toggle it already has; verify tests cover selecting, selecting again to clear, and that the mark and the actions sit with the flow's name rather than drifting to the middle of a card whose tags wrap.
- [x] 1.3 Lead the card with edit and play, and move duplicating, copying and removing behind one overflow control, per design D7; verify tests cover each of the three still being reachable by name, and that removing still removes. The check that replaced the copy icon for two seconds is now a toast — the menu closes on the click, so the confirmation has to outlive it.

## 2. The editing panel gets the room

- [x] 2.1 Widen the editing panel to 384px, leaving the flows list at 320px per design D4; verify `getViewportCenter` still matches the list it measures — it does, it is only ever called from the list.
- [x] 2.2 Fold the flow's description, tags and participants behind a disclosure, keeping the name outside it, per design D5; verify tests cover a stored flow opening closed, a new recording opening open, and the description still being written when the disclosure is open.
- [x] 2.3 Check the panel in the running app with a seeded flow. Done, in `light` and `dark`: the object, the seven steps and one step's fields on screen at once, the object staying pinned while the list scrolls. **Two things the tests could not have said:** the card's mark and actions were centred against a card whose tags wrap to a second line, so they floated beside nothing — fixed by aligning them with the name; and the list did not come back when the session ended, which is 2.4.
- [x] 2.4 Bring the flows list back when an editing session ends, per design D8, since the list is now the only route to another flow; verify tests cover the hand-off both ways, a workspace where no session ever ran, a second session after the first, and a session ending inside a collaboration, where the panel stays away.

## 3. The step's fields

- [x] 3.1 Reorder the call's fields to direction, route, body, expects, async per design D6; verify a test asserts the order on screen rather than the presence of the fields.
- [x] 3.2 Give the direction control a label naming the question; verify the label is asserted and the two values still set what they set.
- [x] 3.3 Leave the step's prose in the order the reading renders it, per design D6; verify a test pins title, note and description in that order so a later tidy-up has to argue with it.

## 4. Strings

- [x] 4.1 Add every new string to `en` and `pt-BR` with no default at the call site, and drop `flowScript.openScript`, which named the chevron that is gone; verify the flow locale coverage test passes.

## 5. Gates

- [x] 5.1 `npm run typecheck` clean, `npm run lint` at the unchanged 27 warnings and 0 errors, `npm run test` 178 files / 1769 tests passing, Prettier clean on everything touched.
- [x] 5.2 `openspec validate flow-editing-panel --strict`.
