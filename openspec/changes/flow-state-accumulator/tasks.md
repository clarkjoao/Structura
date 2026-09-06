## 1. The scope the author writes against

- [x] 1.1 Fold the whole path — the step included — in `FlowScriptList.scopeOf` and subtract the keys the step's own `sets` introduce, per design D4, so the panel written in and the panel read from call the same function with the same argument; verify a test asserts the editor's scope and the reading's running object hold the same keys at every step of a flow that closes two frames, and that the test fails against `slice(0, -1)`.
- [x] 1.2 Carry the frame each value belongs to through to the editor, replacing the flat `ScopeEntry` list with the reading's grouping — innermost call first, the outermost group named as outside any call; verify tests cover a value in an enclosing call, a value outside every call, and a step no path reaches folding to nothing without failing.
- [x] 1.3 Mark the group held by the frame the step closes as leaving after this step, naming the call; verify tests cover the marking, its absence on a step that closes nothing, and a step closing a frame that holds no values.
- [x] 1.5 Mark a key the step consumes that nothing in scope sets, so the report the reading has always made is also made where the key is written; verify tests cover the marking and its absence when every key read resolves.
- [x] 1.4 Remove the claim from `StepContextEditor`'s docblock that the panel is folded exactly as the reading folds it, and state what actually holds; verify by reading it against 1.1.

## 2. The change a step makes

- [x] 2.1 Add `diffContexts(before, after, closedFrames)` to the reading's variables module per design D1 and D2 — introduced, replaced with the value being replaced, and gone with the call that took them; verify unit tests cover a value introduced, a value written over, a frame closing with values, the entry step, a step that touches nothing, and that going back reports the step arrived at.
- [x] 2.2 Put the running object above the payload roots and open it by default, per design D7; verify the panel tests assert the order and the default, and that a reader who closes it keeps it closed while walking.
- [x] 2.3 Show the delta above the entries — introduced, replaced, gone, with the call named when a frame closed; verify tests cover each count, the naming, and the bar being absent when nothing changed.
- [x] 2.4 Give the entry rows the two states they lack: replaced, showing the value that was there, and leaving, dimmed with the call it goes with, per design D3; verify tests cover both, their absence on an untouched row, and that a leaving row is gone on the following step.
- [x] 2.5 Add every new string to both locales with no default at the call site; verify the locale coverage test passes and the panel reads in `en` and `pt-BR`.

## 3. The values table

- [x] 3.1 Complete a row and open the next from the keyboard, focusing the new row's key; verify tests cover the append, the focus, and that it does not fire from the value cell of a row that is not the last.
- [x] 3.2 Discard a row left with no key when focus leaves the table, so an abandoned row changes nothing about the step; verify tests cover the discard, a keyless row with a value still discarded, and a row being typed not discarded mid-word.
- [x] 3.3 Turn a pasted `key: value` block or JSON object into rows, splitting on the first colon so a value holding one stays whole, per design D8; verify tests cover several lines, a value containing a colon, a pasted object, top-level keys only, and text that is neither shape landing in the cell unchanged.

## 4. Following one value

- [x] 4.1 Add `pinnedKeys` to the playing mode beside `seen`, cleared by `play` and `switchFlow`, per design D5; verify tests cover pinning, unpinning, the clear on switching flows, and that nothing reaches the flow.
- [x] 4.2 Show pinned keys in a strip that stays visible with the roots collapsed, carrying the value held at the step in hand; verify tests cover the value following the reading forward and changing when a step writes over it.
- [x] 4.3 Keep a pinned key visible when the running object no longer holds it, saying it is out of scope rather than hiding it; verify tests cover a key lost with its frame and a key pinned before the step that introduces it.
- [x] 4.4 Add `keyLife(flow, callStack, path, key)` returning the events on the walked path — introduced, read, replaced, gone with a call — per design D6; verify a test pins it against the slow oracle that folds every prefix and diffs consecutive pairs, plus a key never introduced on the path and a key introduced only on a branch not taken.
- [x] 4.5 Show the life of a pinned key as a row of events naming each step by the number the reading shows, each one a jump; verify tests cover the ordering, the numbering and an empty life rendering nothing.

## 5. Seen in the running app

- [x] 5.1 Read the seeded `Criar link — pilha completa` end to end in the running editor; verify by screenshot that the delta bar names the frame that closed, that `url_id` is dimmed on step 6 and absent on step 7, and that the editor's scope on step 7 no longer offers what the reading calls unset.
- [x] 5.2 Pin a key and walk the whole reading; verify by screenshot that it survives the frame closing as *out of scope* and that its life names the steps that introduced, read and ended it.
- [x] 5.3 Author a context with the keyboard alone — a row, the next row, an abandoned row; verify by screenshot that nothing needs the mouse and the step holds exactly what was typed. **The paste is covered by unit tests only** — driving a real clipboard through the automation is not something a screenshot can honestly witness.
