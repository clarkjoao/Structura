## Context

See proposal.md — Why. What already exists and what this builds on:

- `EndpointComponent` is an ordinary component: `method`, `path`, `handlers[]`, parented by an
  `ApiGroupComponent` that carries `serviceName`, `basePath`, `protocol`, `sla`.
- `EndpointHandler.flowId` points the other way — an endpoint naming the flow that *implements* it.
- `FlowStep` carries `componentId` (a node) and `connectionId` (an edge), and nothing else that could
  identify a route.
- `describeStepHeading` heads a step by: title → condition label → component name → connection label.
- `getFlowParticipants` collects the components and connections a flow touches; `buildCoverage` turns
  that into "which flows touch this element".
- `flow-step-provenance.test.ts` is a type-enforced table: a new optional field on `FlowStep` will not
  typecheck until someone names its producer and its consumer.

## Goals / Non-Goals

**Goals**

- One stored field, and every use of it derived from that field, in both directions.
- Additive to the point of invisibility: a diagram written before this change looks identical after it.
- Leave the seam an OpenAPI importer will need, without building any of it.

**Non-Goals** — beyond the proposal's: no change to how a step is recorded from a canvas click. The
recorder writes `componentId` and `connectionId` from what was clicked; naming a route stays a
deliberate act in the script panel, because clicking an endpoint node is already how you record a step
*at* it.

## Decisions

### D1 — A field of its own, not a second meaning for `componentId`

`componentId` means *the node this step happens at*, and in practice that is the sender: in the seeded
`Criar link`, the step that calls the Management API carries `componentId` of the **Dashboard SPA**. An
endpoint sits on the receiving side. Pointing `componentId` at an endpoint would put the step's canvas
highlight on the callee while every other step highlights the caller, and `describeStepHeading` would
have no way to tell the two meanings apart.

So: `endpointId?: string`.

*Alternative considered:* reuse `componentId` and disambiguate with a type guard on the component. It
costs no migration, and it was tempting for exactly that reason — but it makes one field answer two
questions, and the canvas would quietly start lighting up a different end of the same arrow.

### D2 — The reverse direction is derived, never stored

An endpoint does not learn which steps call it; the question is answered by walking the flows. One
stored fact, two readings of it. This is what makes deleting a step safe: there is no second place
holding a reference that could go stale, which is exactly the failure `handlers[].flowId` is exposed to
today when a flow is deleted.

It also means the answer is always as fresh as the flows, and costs a walk of flows that are tens of
steps long.

### D3 — The route outranks the node in the heading, and the author outranks both

New order: title → condition label → **endpoint** → component → connection.

A reader stopped on a call wants to know *what was called*. The node the step sits on is the weaker
answer to that question and the edge label is weaker still — `REST API calls` names a channel, not an
operation.

This does not change any existing reading: the order only shifts for steps that name an endpoint, and
none do. That matters, because reordering the two rules *below* it — putting the connection above the
component — would change the appearance of every reading already written, which is why that separate
complaint is still open and is not being resolved here.

### D4 — The mismatch is reported, not enforced

A step naming both a connection and an endpoint asserts two things that can disagree: the call arrives
at one component, and the route belongs to another. The system says so and does nothing else.

Enforcing it would be wrong in ordinary cases — a gateway forwarding to a service behind it, a call
drawn at container level against a route that lives a level down — and the product's whole stance on
contracts is to report. It joins the unset read and the contract diff rather than becoming an error.

*Not decided here:* whether the check should follow parenthood up more than one level. The first pass
compares the endpoint's owning api-group, and its parent chain, against the connection's target.

### D5 — `handlers[].flowId` stays, because it answers a different question

`endpoint.handlers[].flowId` says *this flow describes what happens when this route is hit*. The new
`step.endpointId` says *this step calls that route*. Implementation versus call site. Keeping both is
not duplication, and neither can be derived from the other: a route can be called by scripts that say
nothing about how it is served, and served by a script no other script calls.

The panels should eventually say which is which — the group panel offers "associate flow" with no hint
that it means the handler side. Out of scope, worth a sentence in the strings.

### D6 — Seeding the link is part of the change

The seeded `Criar link` script calls the Management API twice while five seeded routes sit beside it
naming nobody. Pointing the script's calls at `POST /urls` is what makes the feature visible on a fresh
install rather than only in a test, and it is what will make an OpenAPI import obviously worth having.

## Risks / Trade-offs

- **A second way to say roughly the same thing.** A reader now meets `componentId`, `connectionId` and
  `endpointId` on one step and has to know which is which. → The provenance table forces each to name a
  producer and a consumer, and the heading order settles precedence in one place.

- **The heading changes for a step someone later points at a route.** Setting an endpoint silently
  changes how that step reads in the spine. → It is the point of setting it, and the author's own title
  still wins; nothing changes without the author acting.

- **The mismatch check will fire on legitimate diagrams.** A call drawn at container level against a
  route one level down is normal. → It is a report with no consequence, and D4 leaves the depth of the
  parent walk open precisely because the first shape is a guess.

- **Nothing forces the field to be used.** Like `expects`, it can sit unset forever and the feature
  quietly earns nothing. → The seed uses it, coverage shows a route nobody calls, and the OpenAPI
  import that follows is what turns setting it from a chore into an import.

## Migration Plan

None. A new optional field on `FlowStep`; steps written before it are unchanged and read identically.
`flow-migration.ts` needs no branch, which the migration round-trip test asserts.

## Open Questions

- Whether a step should be able to name a route it reaches through *no* connection at all — a step that
  is only "this route is called here". Allowed by the spec as written, and harmless; whether the script
  panel should encourage it can wait for someone to want it.
- How far up the parent chain the mismatch check should walk (D4). Answerable once real diagrams have
  routes on them, and it changes no requirement.
