## Context

Three facts already exist separately, and nothing joins them.

| fact                                     | where it lives           | who reads it                               |
| ---------------------------------------- | ------------------------ | ------------------------------------------ |
| this route is implemented by that script | `EndpointHandler.flowId` | the editor's route row, first handler only |
| this step calls that route               | `FlowStep.endpointId`    | the `↗ N` badge, as a count of names       |
| this diagram has scripts                 | `snapshot.flows`         | the viewer's invite strip, as a flat list  |

The reader of a shared diagram gets only the third, which is the one that knows least about what they
are looking at.

## Goals / Non-Goals

**Goals**

- One derivation for "the scripts associated with this route", used by every surface.
- A route that plays in a shared diagram, not only in the editor.
- A share link that can open on a script.

**Non-Goals**

- Writing anything to a route.
- Any editing in the viewer.
- Changing the playback machine, the navigator, or the numbering.

## Decisions

### D1 — Associated means implemented-by _or_ called-by, and it is derived

A route is associated with a script when the route's handlers name it — _this script implements this
operation_ — or when one of the script's steps names the route — _this script calls this operation_.
Both are already stored; neither is stored on the route.

Deriving both together rather than keeping a list on the endpoint is the same argument
`endpointCallers` already makes and this change inherits: a step deleted from a script leaves no stale
reference behind, because there was never a second copy of the fact. A handler's `flowId` _is_ a stored
reference and can go stale — so a handler naming a flow that no longer exists is dropped when the
association is derived, rather than shown as a script that cannot be played.

### D2 — The first handler stops being the answer

`activeFlowId: ctx.activeFlowId ?? comp.handlers?.[0]?.flowId ?? null` has two faults in one line.

`handlers?.[0]` silently ignores every handler after the first. That is a real loss — `EndpointPanel`
writes as many handlers as an author adds — and it is separate from the `ApiGroupPanel` defect that
_discards_ them, which stays out of scope.

`ctx.activeFlowId ??` puts the currently-playing script's id on **every** route on the diagram while a
reading is running, whether or not the route has anything to do with it. Every route grows a play
button mid-reading, all of them for the same script. It goes: what a route offers is what a route is
associated with, playing or not.

### D3 — The row is a shortcut; the group's footer is the list

A route with several associated scripts cannot show them all in a 40px row beside a method, a path and
a caller badge. The options were a menu inside a canvas node, or an arbitrary pick.

Neither, exactly: the row's `▷` plays the first and names it in its title, and shows `▷ N` with all of
them named when there are more — a shortcut that admits it is one. The full list, one click each,
lives in the api-group's footer, where the reader is already looking and where the space is free.

A menu inside a node was rejected on cost, not taste: nodes in the viewer are `selectable: false` and
sit under React Flow's own pointer handling, and a portalled menu there is a thing to own rather than
a thing to add.

### D4 — The group's footer is already a mode-dependent slot

In the editor the api-group's footer is `+ Adicionar endpoint`. Under `controlsDisabled` — the viewer,
and compare mode — that button is hidden and the 40px strip renders empty. It is not a new slot being
invented; it is a slot with one state today and a second one now: the scripts running through this
group, each a button.

The editor keeps the add-endpoint button and does not get the list. It does not need it — the flows
panel is one click away, and the group's routes each carry their own `▷`.

### D5 — The script travels beside the payload, not inside it

`stripForShare` already removes `activeSceneId`, on the grounds that which scene the author had open is
not part of the diagram. The script an author wants read is the same kind of fact — not part of the
diagram, part of the _invitation_ — so it goes in the link as its own parameter rather than into the
compressed payload.

Three things follow, and each is a reason:

- A link can be pointed at a different script by editing one short parameter, without recompressing.
- The parameter and the payload can disagree — a link kept while the script was deleted — so the
  viewer checks that the named script is in the diagram it received, and ignores it if not, rather
  than opening a reading of nothing.
- The share URL's size warning keeps measuring the diagram, which is what makes it large.

### D6 — Arriving on a script still leaves the way out

A reader who arrives with a script playing can close it, and lands on the diagram with the invite strip
— the same place a reader who arrived with no script starts from. The link decides where a reading
starts, never that a reading is all there is.

### D7 — A reader's control has to opt back into being clickable

Found by clicking one. React Flow gives a node's wrapper `pointer-events: none` when the node is
neither draggable, selectable nor connectable — which is every node in a shared diagram, since the
viewer switches all three off to keep it read-only. The property is inherited, so _nothing_ inside any
node could be clicked; the click landed on `.react-flow__pane` and panned the canvas instead.

The route's `▷` had been in the editor's node component for as long as the component has existed, and
it had never worked in the viewer, because until now it never appeared there.

The fix is a class on the controls a reader is meant to use, and one rule in the viewer's stylesheet
setting `pointer-events: auto` on it — a child may opt back in under a parent that opted out. Making
the nodes selectable instead was rejected: it would give a read-only diagram selection rings and a
selection to manage, to fix a hit-test.

### D8 — The callback a route carries must not change as the reading runs

Also found in the running app. The play callback is built into the data of every node, and it closed
over the playback slice, whose identity changes on every step of a reading. So each step rebuilt the
whole node array, React Flow answered by re-measuring every node, and each node went
`visibility: hidden` for a frame — the whole diagram blinking once per step.

The callback is held in a ref that is reassigned on render and handed out as a stable function, the
same shape `useCanvasNodes` already uses for the editor's node callbacks. What a route offers then
changes only when the diagram or its scripts do.

### D9 — One reading surface, and it is the rail

The viewer had the floating step navigator the product started with; the editor has the rail that
replaced it. Keeping both meant every change to a reading had to be made twice, and the viewer — the
surface a _reader_ sees — kept the older one.

The rail was already built for this: it takes the diagram as a prop precisely because the viewer has
no store. Swapping it in deleted the navigator, its test, and five strings no longer used by anything.

### D10 — Following the reader is one rule, shared

Bringing the step into view lived in the editor's canvas effects, where the viewer could not reach it.
That is the whole reason a shared diagram stepped through a script without ever moving. It moves to a
hook of its own, and both surfaces call it.

**Not delivered, and stated rather than hidden:** a step whose only target is a _route_ is still not
framed, and a reader arriving on a script the link named lands on the whole diagram rather than on its
first step. Framing the route was tried and reverted — it broke the framing that works — and the
arrival is a race with React Flow's own initial fit that three attempts did not settle.

### D11 — The reading's keys are the reading's, not the page's

They were registered by the workspace page, so they existed only where that page did: a shared diagram
ran the same playback machine and could only be walked by clicking. They move next to the rail they
belong to, and both surfaces bind them.

Nothing about the rule changes — arrows walk, Escape closes, F10 steps over, Shift+F11 steps out, F11
stays the browser's fullscreen, and the forward key declines to pick a way at a branch point.

## Risks / Trade-offs

- **A route can now claim scripts an author did not think of.** A script that calls `POST /urls` makes
  that route playable even though it is another service's operation. That is the association being
  honest — the call is in the script — and the title says which scripts, by name.
- **The group's footer says two different things in two modes.** Accepted per D4; the alternative was a
  strip that stays empty in the mode where it has the most to say.
- **A shared link outlives the script it names.** Handled in D5 by checking, not by trusting.

## Open Questions

- Whether the editor's api-group should also list the scripts through it, somewhere other than the
  footer. Left alone: the flows panel already does, and the routes carry their own controls.
