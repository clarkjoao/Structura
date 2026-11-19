## 1. One column, one anatomy (M1)

- [x] 1.1 Extract `PanelColumn` from `PanelFrame`; dock the flows list and editor in it with `PanelHeader`/`PanelSection`.
- [x] 1.2 Hide the inspector while the flows panel holds the column; the rail's inspector button reclaims it.
- [x] 1.3 Put the script rows, object block and JSON fields on the inspector's type scale.

## 2. Writing a flow (M2)

- [x] 2.1 Recording strip on the canvas: target, step count, undo, finish; verify by test and in the editor.
- [x] 2.2 Remove the `branch-select` mode, `BranchSelectView` and `BranchRecordingStrip`; branch heads in the script become write targets; verify a click lands in the chosen branch. A branch that runs straight back to the trunk is not offered: the store refuses to record into it (it has no sequence of its own).
- [x] 2.3 Converting a step to a condition moves the recorder into its first branch; verify by test.

## 3. Reading a long flow (M3)

- [x] 3.1 Window the spine's past and upcoming rows with reveal controls; verify by test.
- [x] 3.2 Make the variables block foldable, folded by default on a windowed reading; verify by test.

## 4. Close

- [x] 4.1 Strings in `en` and `pt-BR`; typecheck, lint, format, vitest, fallow green (pre-existing opscr finding excepted).
