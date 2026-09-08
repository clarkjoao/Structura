## 1. What a route is associated with

- [x] 1.1 Derive the scripts associated with a route — handlers naming one, and steps calling it — per design D1, dropping a handler whose script is gone; verify tests cover a handler, a caller, both at once naming one script, a stale handler, two handlers, a route with nothing, and a route with no handlers field at all.
- [x] 1.2 Derive the same for an api-group over the routes it holds, naming each script once; verify tests cover two routes with two scripts, two routes with one, a group with nothing, and a group holding a child that is not a route.

## 2. What the canvas offers

- [x] 2.1 Build the route's control from the derivation instead of `handlers?.[0]?.flowId`, and stop falling back to the script being read, per design D2; verify a test shows a route unrelated to the reading offering nothing while a reading runs. `ctx.activeFlowId` had no other reader and went with it.
- [x] 2.2 Name what the control plays, and say how many when there are more, per design D3; verify tests cover one script, several, and none.

## 3. What a shared diagram offers

- [x] 3.1 Give the viewer's routes the same association and the same control, wired to the viewer's own playback; verify a test plays a script from a route in a shared diagram and asserts the reading started.
- [x] 3.2 List the scripts running through an api-group in its footer where the add-endpoint button is not offered, per design D4; verify tests cover a group with scripts, a group with none, and that choosing one starts it.
- [x] 3.3 Let a reader's control be clicked at all, per design D7 — every node in a shared diagram carries `pointer-events: none`, so the click reached the pane and panned the canvas. **Found by clicking one in the running app; no test would have caught it, because jsdom has no hit-testing.**
- [x] 3.4 Keep the route's callback stable across a reading, per design D8, so a step does not rebuild and re-measure every node on the diagram.

## 4. The share names a script

- [x] 4.1 Carry a script's id in the share and embed links beside the payload, per design D5; verify tests cover a link with a script, one without, that the payload is byte-identical either way, and an id holding an `&`.
- [x] 4.2 Let the author name it when sharing, offering the diagram's scripts and none; verify tests cover the options offered, the link changing with the choice, taking it back out, and a diagram with no scripts not being asked.
- [x] 4.3 Open the viewer on the named script, ignoring one the diagram does not hold, per design D5 and D6; verify tests cover arriving on a script, arriving on none, a script that is not there, and closing the script to reach the list. Both routes in: the share view and the embed page.

## 5. Strings

- [x] 5.1 Add every new string to `en` and `pt-BR` with no default at the call site; verify the locale parity test passes.

## 6. Gates

- [x] 6.1 `npm run typecheck` clean, `npm run lint` at the unchanged 27 warnings and 0 errors, `npm run test` 183 files / 1807 tests passing, Prettier clean.
- [x] 6.2 Seen in the running app, on the seeded `URLShort — Componentes da Management API`: a link that opens straight into `Criar URL — Fluxo Interno`; `POST /urls` played from its own row in the shared diagram; the api-group's footer, empty before, listing the script; and closing the reading landing on the diagram's own list.
- [x] 6.3 `openspec validate shared-flow-reading --strict`.

## 7. One reading, in both places

- [x] 7.1 Put the editor's reading rail into the shared diagram, beside the canvas, per design D9; verify the viewer's tests assert against the rail — the spine rather than a counter, the branches inside the scene.
- [x] 7.2 Delete the floating step navigator, its test, its exports and the five strings nothing used any more; verify the locale parity test passes and no import survives.
- [x] 7.3 Bring the step into view as the reader moves, from a hook both surfaces call, per design D10; verify in the running app — the shared diagram now zooms to each step as the reader advances.
- [x] 7.5 Bind the reading's keys next to the rail rather than in the workspace page, per design D11, so a shared diagram answers them too; verify tests cover forward, back, close, the branch point declining to pick, F10/Shift+F11, F11 left alone, and nothing bound while no reading is open. Checked in the running app with real key presses.
- [ ] 7.4 **Not done.** Frame a step whose only target is a route, and frame the first step when a link opens on a script. See design D10: the first was tried and reverted for breaking what works, the second is a race with React Flow's initial fit.
