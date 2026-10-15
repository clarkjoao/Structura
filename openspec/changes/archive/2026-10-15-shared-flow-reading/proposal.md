## Why

A shared diagram already opens as a reading. What it does not do is start from the thing the reader is
looking at.

Opening `URLShort — Componentes da Management API` through a share link shows the api-group `/api/v1`
with its five routes, and a strip along the bottom saying _this diagram has one script: Criar URL —
Fluxo Interno_. The strip works: the script plays, the nodes carry their numbers, the navigator steps
through it. Two things are missing from that picture, and both are about the route.

**The route knows which script it belongs to, and says nothing.** `POST /urls` carries a handler naming
that exact flow. In the editor the row shows a `▷` because of it. In the viewer the same row shows
nothing — the endpoint's data is rebuilt by hand for the viewer, with `controlsDisabled: true` and no
flow wired at all. The api-group's footer, which is the _add endpoint_ button in the editor, is an
empty grey strip there.

**The `▷` it does show is built on the wrong half of the evidence.** It reads `handlers?.[0]?.flowId`
— the first handler of a route, and only a handler. Since a step can name the route it calls, the
other direction exists and is derived already: `endpointCallersByRoute` walks every script and reports
which steps call which route. A route is associated with the scripts that _implement_ it and the ones
that _call_ it, and only the first half, truncated to one, reaches the canvas.

And the share link itself carries no intent. An author sharing a diagram to explain one flow has to
send the link and then say, in another window, _click the one at the bottom_.

## What Changes

- **Add** a derivation for the scripts associated with a route — the ones its handlers name and the
  ones whose steps call it — and the same for an api-group, over the routes it holds.
- **Change** the route's `▷` to be built from that, instead of the first handler, so a route reached
  only by a call is as playable as one carrying a handler.
- **Add** the same to the viewer, where a route currently offers nothing: the row plays, and the
  api-group's footer — dead space in read-only — becomes the list of scripts running through it.
- **Add** a script to the share: the author picks which one the link opens on, and the reader arrives
  with it already playing.
- **Change** nothing about how a reading runs. The viewer already drives the editor's own playback
  state machine; this only decides where a reader starts.

## Capabilities

### New Capabilities

- `shared-flow-reading`: a route says which scripts run through it, in the editor and in a shared
  diagram, and a share link names the script it opens on.

### Modified Capabilities

<!-- `flow-step-endpoint` is an unarchived change rather than a published spec. Its derivation
     (`endpointCallersByRoute`) is consumed here rather than changed; the requirement that a route
     reports its callers is untouched. -->

## Non-Goals

- **Not editing from the viewer.** A shared diagram stays read-only; the only thing gained is a way to
  start a reading.
- **Not a second reading UI.** The step navigator the viewer already uses is the one that runs.
- **Not the `ApiGroupPanel` handler defect.** The group panel still reads `handlers?.[0]` and writes an
  array of one, discarding the rest, while `EndpointPanel` keeps them all. Reading _every_ handler here
  makes it easier to hit, and it stays out of scope — it is recorded in `flow-step-endpoint`.
- **No new stored field.** The association is derived from what is already there: a handler's `flowId`
  and a step's `endpointId`. Nothing is written to a route.
- **Not a picker in the link for scenes, steps or anything else.** One script, or none.

## Impact

- `src/features/diagram/utils/flow-endpoint.ts` — the scripts associated with a route and with a group.
- `src/features/canvas/nodes/node-types/{endpoint,apigroup}.descriptor.ts` — built from the derivation.
- `src/features/canvas/nodes/EndpointNode.tsx`, `ApiGroupNode/index.tsx` — what the route offers.
- `src/features/viewer/hooks/useDiagramToFlow.ts` — the viewer's routes gain the same data.
- `src/features/viewer/components/ViewerCanvas.tsx` — plays what a route asks for, and opens on the
  shared script.
- `src/lib/diagram-url.ts` — the script travels beside the payload, not inside it.
- `src/pages/workspace/ShareModal.tsx` — choosing it.
- `src/features/viewer/hooks/useSharedDiagram.ts`, `src/pages/ViewerPage.tsx` — reading it back.
- `src/infrastructure/i18n/locales/{en,pt-BR}.json` — new strings in both locales.
