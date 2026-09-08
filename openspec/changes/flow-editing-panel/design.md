## Context

Flow authoring reached its current shape by accretion. The recorder came first: a panel of its own,
beside the canvas, where clicking a node writes a step. Editing a stored flow was added by pointing
the pencil at that same panel with `isNewFlow: false`. The script — the list of steps and the form for
one of them — was added later still, and it was made reachable without recording by expanding a card
in the flows list, because that was where a stored flow already was.

That last step is the one that went wrong. It did not give the script a home; it gave it a second one,
smaller than the first, reached by a different icon on the same card.

## Goals / Non-Goals

**Goals**

- One surface where a flow is written, with room for the form it holds.
- A flows panel that does one thing, and says which flow is selected.
- A call's fields asked in the order the call is decided in.

**Non-Goals**

- Changing what an editing session is, or when it commits.
- Changing any step field's meaning, or the running object's derivation.
- A resizable or dockable panel.

## Decisions

### D1 — The inline script goes, rather than being made to fit

The obvious alternative is to keep both and make the inline one work: give the card more height, put
the step form in a popover, collapse the other flows while one is open. Each of those is a way of
rebuilding, inside a list, the panel that is already beside the list.

The inline script has no capability the panel lacks. It is reached in one click instead of two, and
that is the whole of its advantage — paid for by a Monaco editor in a 320px column between two other
flows. Two surfaces for one job also means every future field has to be designed twice, and the
narrow one decides the design.

So: one surface. The cost is honest and stated — seeing a stored flow's steps now costs a click and
an editing session, where it used to cost a chevron.

### D2 — Selecting a flow keeps the meaning it already had

`scriptFlowId` was never only "the flow whose script is open". It is also the flow the canvas is
numbered from, and the store says why: labels only mean something inside one flow's graph, so two
flows numbering the same node at once would put two unrelated numbers on it.

That meaning survives on its own. The card keeps the click, keeps the toggle, and keeps setting
`scriptFlowId` — what it stops doing is unfolding an editor underneath. The chevron, which promised a
disclosure, becomes a mark that says _this is the flow the canvas is counting_.

### D3 — The editing panel is the recorder's panel, not a new component

`FlowRecorderPanel` already renders the whole script, already knows the difference between recording
and editing, already owns the header that says which, and already owns the footer that finishes or
cancels the session. Splitting it into two components would duplicate all four to change a title.

It keeps its name. The name is about where it sits in flow mode — the panel that is up while a
recording session is — and a session is exactly what editing opens. Renaming it to `FlowEditorPanel`
would rename a file, touch its imports and its tests, and say nothing the header does not already say
out loud in two languages.

### D4 — The editor is 384px; the list stays 320px

The panels are siblings of the canvas in a flex row, so widening one narrows the canvas and nothing
else. The list holds a name, a line of counts and a row of icons, and 320px fits it; the editor holds
labelled fields, two code editors and an object whose keys are 13 characters wide, and it does not.

The list stays 320px for a second reason: `getViewportCenter` subtracts a hardcoded 320 when the flows
panel is open, so that an imported diagram lands in the middle of what the author can see. It is only
ever called from the flows panel. Widening the editor leaves it correct; widening the list would make
it silently wrong by 64px, which is exactly the kind of number nobody goes looking for.

### D5 — The flow's own fields fold; its name does not

The name, the description, the tags and the participants sit above the script in a block that cannot
scroll away — roughly a fifth of the panel, permanently, to hold four things that are written once.

They fold into a disclosure, and the name stays outside it. The name is the one field that is required
(an empty one is filled in with "Unnamed flow" on finish), the one shown everywhere else in the
product, and the one a new recording opens focused on. Folding it to save 28px would cost more than it
saves.

The disclosure starts closed. A new recording is the exception: nothing has been written yet, so
description and tags are as likely to be wanted as anything else, and the block opens.

### D6 — The order of the fields

Two groups, and they are ordered on different grounds.

**The step's prose — title, note, description — keeps the order it has.** It looks wrong (a textarea
between two single-line inputs) and it is not: it is the order the reading renders them in. The title
is the heading, the note is the body, the description is the aside beneath it. An author writing top
to bottom is writing the scene top to bottom. Reordering these to look tidier in the form would put
the form and the reading in different orders, which is the more expensive kind of tidy.

**The call's fields are reordered, because their current order contradicts what they do.**

| now          | after         | why                                                                                                                                                       |
| ------------ | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| route        | **direction** | It decides what the step _is_, it pairs the step with its answer in the reading, and it decides whether "expects back" exists at all. It cannot be third. |
| direction    | route         | Which operation, once we know it is an operation going out.                                                                                               |
| body         | body          |                                                                                                                                                           |
| async        | expects back  | The two JSON fields belong next to each other; a request's body and the shape it expects back are read together and written together.                     |
| expects back | async         | A modifier on the call, after the call is described.                                                                                                      |

The direction control gains a label. It is the only control in the form without one — a bare pair of
buttons reading `→ Request` / `← Response`, which names the values and never names the question.

`duration` stays at the end of the step's own fields rather than joining `async`. It applies to any
step, including one that is not a call; `async` is only offered on a call. Grouping them would mean
showing `duration` twice or moving it into a section it does not always belong to.

### D7 — Two actions named, three behind one control

A flow's card carries five icon buttons — duplicate, copy as Mermaid, edit, play, remove — at 14px,
in a row, with nothing to separate the two anyone came for from the three they did not.

Edit and play stay, named and apart. Duplicate, copy and remove move behind a single overflow, which
is also where a destructive action stops sitting 4px from the one that starts a playback. Every item
keeps the accessible name it has, so what could be found by name before still can.

### D8 — Ending a session puts the list back, and it needs nothing remembered

Found by opening the editor and cancelling it: the flows panel did not come back. It never had —
starting a session closed it and nothing reopened it — and until now that cost almost nothing, because
a flow's steps were reachable from a card as well. With D1 applied, the list is the only route to
another flow, so a session that ends into an empty canvas is a dead end.

The rule needs no memory of whether the panel was open. Every session starts from that panel: the
pencil on a flow, or the button under the list. So "a session ended" is enough to know it was open.

It lives in a hook of its own (`useFlowPanelHandover`) rather than as one more `useEffect` in the
workspace page, because the page has no test harness — it wants a router, a collaboration provider, a
React Flow instance and the store — and this is a rule with four cases worth pinning, one of them the
collaboration a session must not reopen the panel into.

## Risks / Trade-offs

- **A stored flow's steps cost more to look at.** Accepted, and it is the point: the cheap way in led
  to the unusable surface. If reading a flow without editing it turns out to be a real need, it is a
  reading, and the reading rail already exists to be it.
- **The overflow hides `remove`.** One click deeper for a destructive action is the trade the grouping
  is making, in both directions.
- **Two panel widths.** A 64px jump when the editor replaces the list. It reads as a mode change,
  which is what it is.

## Open Questions

- Whether the editing session should be able to stay open while the flows panel is browsed — today
  the panel is replaced, and both were always mutually exclusive. Left alone here.
