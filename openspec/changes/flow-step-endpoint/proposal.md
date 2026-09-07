## Why

A flow step can say which edge a message travels and which node it happens at. It cannot say **which
route it calls**. The product describes the same API in three places that never check one another:

| where | what it holds | how much of it exists in the seed |
| --- | --- | --- |
| `api-group` + `endpoint` | method and path | 5 endpoints |
| `FlowStep.payload` | an example body, in motion | 18 payloads |
| `FlowStep.context.expects` | the shape expected back | **1** |

Three consequences follow from the missing link, and all three are visible today:

- The reading names a call by its edge label — `REST API calls` — or by the sender's name. A reader
  following a script sees a column of participant names where they wanted `POST /urls`.
- The endpoints on the canvas do not know which scripts exercise them. Coverage, which already answers
  that question for nodes and edges, has nothing to say about a route.
- `checkContract` compares a hand-written `expects` against a hand-written response body. Both are
  written by the same person in the same sitting, so it can only catch someone disagreeing with
  themselves — which is why one step in the whole seed carries an `expects` at all.

The seam is nearly there. `EndpointHandler.flowId` already lets an endpoint name the flow that
implements it, and it is set on **one of five** seeded endpoints, because today it buys a play button
and nothing more. What is missing is the other direction: a step naming the route it calls.

## What Changes

- **Add** an optional endpoint reference to a flow step: the route this step calls.
- **Change** the reading's heading to prefer that route over the node the step sits on, so a call
  reads as `POST /urls` rather than as the name of whoever sent it. Purely additive — no step names an
  endpoint today, so no existing reading changes.
- **Add** the reverse direction as a derivation: which steps, in which flows, call a given endpoint.
  Nothing is written to the endpoint, so a deleted step cannot leave a stale reference behind.
- **Change** flow participants and coverage to count endpoints, so a route the scripts never exercise
  is as visible as an unused component is now.
- **Add** a reported mismatch when the endpoint a step names is not reachable through the call the step
  makes. Reported, never blocked — the same stance as an unset read and a broken contract.
- **Add** a way to set it while recording and while editing a script.

## Capabilities

### New Capabilities

- `flow-step-endpoint`: a step names the route it calls; the reading, the canvas and coverage read it,
  and the endpoint learns which scripts exercise it without storing anything.

### Modified Capabilities

<!-- The reading capabilities this touches (`flow-reading-call-stack`, `flow-reading-variables`) are
     still unarchived changes rather than published specs, so their behaviour is extended through the
     new capability above rather than by a delta against `openspec/specs/`. -->

## Non-Goals

- **No OpenAPI import.** That is the next change and the reason this one exists: an importer needs
  somewhere to put a route before it is worth writing. This change builds only the reference.
- **No schemas, and no derived `expects`.** Once a step names an endpoint and an endpoint carries a
  response schema, `expects` can be derived instead of typed — but the endpoint has no schema yet.
- **No export back to OpenAPI.** The diagram will never hold enough to regenerate a specification, and
  a round trip that quietly loses most of a document is worse than no round trip.
- **Not a second meaning for `componentId`.** See design D1.
- **Not the `ApiGroupPanel` handler defect.** The group panel reads `handlers?.[0]` and writes an array
  of one, so editing an endpoint from the group silently discards every handler after the first, while
  `EndpointPanel` keeps them all. Real, adjacent, and out of scope here — named so it is not lost.

## Impact

- `src/features/diagram/model/flow.types.ts` — the new optional field, plus its row in the provenance
  table, which will not typecheck until a producer and a consumer are named.
- `src/features/diagram/utils/flow-traversal.ts` — participants gain endpoints.
- `src/features/diagram/utils/flow-validate.ts` — the reported mismatch.
- `src/features/canvas/flow/reading/readingScene.ts` — the heading order.
- `src/features/canvas/flow/script/FlowScriptRow.tsx` — choosing the route on a step.
- `src/features/canvas/flow/flowState.ts` — coverage over endpoints.
- `src/features/canvas/nodes/EndpointNode.tsx` — the scripts that exercise this route.
- `src/fixtures/seeds/urlshort-example.ts` — the seeded scripts point at the seeded routes.
- `src/infrastructure/i18n/locales/{en,pt-BR}.json` — new strings in both locales.
