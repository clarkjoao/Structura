## 1. One column, one anatomy (M1)

- [x] 1.1 Extract `PanelColumn` from `PanelFrame`; dock the flows list and editor in it with `PanelHeader`/`PanelSection`.
- [x] 1.2 Hide the inspector while the flows panel holds the column; the rail's inspector button reclaims it.
- [x] 1.3 Put the script rows, object block and JSON fields on the inspector's type scale.

## 2. Writing a flow (M2)

- [x] 2.1 Recording strip on the canvas: target, step count, undo, finish; verify by test and in the editor.
- [x] 2.2 Remove the `branch-select` mode, `BranchSelectView` and `BranchRecordingStrip`; branch heads in the script become write targets; verify a click lands in the chosen branch. A branch that runs straight back to the trunk is not offered: the store refuses to record into it (it has no sequence of its own).
- [x] 2.3 Forking from the recording strip (`recordFlowCondition`) writes a condition after the last step and moves the recorder into its first way out; the step panel no longer turns a step into a condition; verify by test.
- [x] 2.4 The reading scene names the step first, then call → target · duration on one line, and the stack as one line of text; verify by test.

## 3. Reading a long flow (M3)

- [x] 3.1 Window the spine's past and upcoming rows with reveal controls; verify by test.
- [x] 3.2 Make the variables block foldable, folded by default on a windowed reading; verify by test.

## 4. Following the reading on the canvas

- [x] 4.1 `readingFrame.planReadingFrame`: step + neighbours at ≤1×, else the step, else the node it lands on; stay when already in view; verify by test.
- [x] 4.2 `useFrameReadStep` frames a step's component and both ends of its call, focusing where the call arrives (as the rail names it); verify in the editor across a 7-step flow (zoom 0.85–1.0 on every step).

## 5. Close

- [x] 5.1 Strings in `en` and `pt-BR`; typecheck, lint, format, vitest, fallow green (pre-existing opscr finding excepted).
