## 1. The reference

- [ ] 1.1 Add optional `endpointId` to `FlowStep` per design D1, and its row to the provenance table naming a producer and a consumer; verify the typecheck fails until the row exists, and that a seeded flow round-trips through `migrateFlow` with no new branch.
- [ ] 1.2 Add a guard that resolves a step's endpoint against the diagram — the component, its owning api-group, and whether either is still there; verify tests cover a live endpoint, a deleted one, an id naming a component that is not an endpoint, and a step naming none.
- [ ] 1.3 Count an endpoint a step names among `getFlowParticipants`, so coverage reports routes as it reports components; verify tests cover a route two flows call, a route nothing calls, and that a flow naming no endpoint has the participants it had before.

## 2. What the reading says

- [ ] 2.1 Head a step by its route, above the component and the edge and below the author's own title, per design D3; verify tests cover the route winning over both, a title winning over the route, and a step naming no route heading exactly as it did before.
- [ ] 2.2 Say when the route a step names is no longer on the diagram, rather than falling back as though the step never named one; verify a test asserts the reading continues and the loss is stated.
- [ ] 2.3 Add every new string to both locales with no default at the call site; verify the locale coverage test passes and the rail reads in `en` and `pt-BR`.

## 3. What the canvas says

- [ ] 3.1 Report, for an endpoint, the flows and steps that name it — derived by walking the flows, with nothing stored on the endpoint, per design D2; verify tests cover two flows calling one route, a route nothing calls, and a deleted step leaving no trace.
- [ ] 3.2 Show on the endpoint node which scripts exercise it, in the shape coverage already uses for a component; verify by screenshot in the running editor.

## 4. What the author does

- [ ] 4.1 Let a step's route be chosen and cleared in the script panel, offering the diagram's endpoints by method and path; verify tests cover setting it, clearing it leaving the field absent rather than empty, and a diagram with no endpoints offering nothing rather than an empty control.
- [ ] 4.2 Report a step whose route does not belong where its call arrives, per design D4 — reported, never blocked; verify tests cover the mismatch, the agreement, a step with a route and no connection, and that the reading continues either way.

## 5. Seen in the running app

- [ ] 5.1 Point the seeded `Criar link — pilha completa` at the seeded routes per design D6; verify by screenshot that the spine heads those steps `POST /urls` and that the endpoint node names the script.
- [ ] 5.2 Assert the seed rather than trusting it: extend the seed coverage test so a script naming a route, and a route named by a script, are both required; verify the test fails when the link is taken out of the seed.
