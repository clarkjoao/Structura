## Why

Two places edit the same flow, and the cramped one is the default.

| where              | how it is reached                           | what it holds                                              | the room it gets                                        |
| ------------------ | ------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------- |
| inside a list card | the chevron on a flow in the flows panel    | the running object, the step list, the step form           | whatever is left of a 320px panel after the other flows |
| its own panel      | the pencil, which starts an editing session | the same thing, plus the flow's name, description and tags | the full height of the window                           |

The first is a worse copy of the second. The flows panel is 320px wide and already holds a header, a
tag filter, one card per flow and the button that starts a new one; opening a script drops the whole
authoring surface _between two other flows_. What lands there is not small: the running object, one
row per step, and — for the step in hand — up to nine controls, one of which is a Monaco editor for
the body and, on a request, a second one for the shape it expects back.

So the same author, doing the same work, gets a usable surface or an unusable one depending on which
icon they happened to click. Nothing about the flow decides it.

The second problem is inside the step form. The call's fields are ordered `route → direction → body →
async → expects`, and the direction is the only one with no label at all — a bare pair of buttons.
Direction is what decides the rest: it is what makes the step a call going out or an answer coming
back, it is what pairs the step with its other half in the reading, and it is what decides whether
"expects back" exists as a field. It is asked third, unnamed, and it splits the two JSON fields from
each other by putting `async` between them.

## What Changes

- **Remove** the script from inside the flows list. The panel lists flows and selects one.
- **Keep** what selecting has always meant — the flow the canvas is numbered from — and say it on the
  card, instead of hiding it behind a chevron that also opened an editor.
- **Change** the editing session's panel into the one place a flow is written: full height, wider than
  the list it replaces, with the flow's own fields folded away so the script gets the height.
- **Change** the order of the call's fields to the order the call is decided in: direction, named,
  first; then the route; then the two bodies together; then async.
- **Fix** the way back: ending an editing session brings the flows list back, instead of leaving the
  workspace with no route to another flow.
- **Change** a flow's row in the list to lead with the two things done to a flow — edit it, play it —
  and put duplicating, copying and removing behind one control.

## Capabilities

### New Capabilities

- `flow-editing-panel`: where a flow is written, and what the flows panel does now that it is not that.

### Modified Capabilities

<!-- `flow-state-authoring` (the object panel) is an unarchived change rather than a published spec,
     and none of its requirements change here: the object panel keeps its behaviour and moves house
     with the rest of the script. -->

## Non-Goals

- **Not a new editing model.** Editing a stored flow still opens a session that is finished or
  cancelled, and still records canvas clicks as steps. Only where it is shown changes.
- **Not a resizable panel.** A width that fits the form is enough; dragging one is a separate thing to
  own, with its own persistence.
- **No field is added or removed from a step.** They are ordered, grouped and labelled. A flow written
  today reads the same tomorrow.
- **Not the reading.** The reading rail, the running object's derivation and the call stack are
  untouched.
- **Not a second way in.** The flows panel does not gain an inline preview of the steps to make up for
  the one being removed; a flow whose steps someone wants to see is opened.

## Impact

- `src/features/canvas/flow/FlowPanel.tsx` — the list stops editing, and its actions collapse.
- `src/features/canvas/flow/FlowRecorderPanel.tsx` — the editing panel's width and layout.
- `src/features/canvas/flow/recorder/RecorderMetadataForm.tsx` — the flow's own fields fold away.
- `src/features/canvas/flow/script/FlowScriptRow.tsx` — the order of the call's fields, and the
  direction's label.
- `src/features/canvas/flow/useFlowPanelHandover.ts` — new: the hand-off between the two panels.
- `src/pages/workspace/WorkspaceContent.tsx` — the hand-off replaces the effect that only closed.
- `src/features/canvas/flow/FlowPanel.script.test.tsx` — asserts the opposite of what it asserts now.
- `src/infrastructure/i18n/locales/{en,pt-BR}.json` — new strings in both locales.
