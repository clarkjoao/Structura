# Design

## One engine per diagram and initiative

An initiative's Version is drawn and edited by an ordinary `OpscrEngine`, given other ports:

| Port            | Root engine                                  | Initiative engine                                                                                                                    |
| --------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| texts `get`     | root buffers (not under `initiatives/`)      | `initiativeSources(product, name)` + config + the merged layout sidecar                                                              |
| texts `set`     | buffers                                      | manifests → `initiativeDelta` → the initiative's buffers; layout → the initiative's sidecar (only boxes that differ from the root's) |
| diagram `get`   | `getDiagram(id, { base: true })`             | `getDiagram(id, { version: name })`                                                                                                  |
| diagram `apply` | `applyChanges(c, { diagramId, base: true })` | `applyChanges(c, { diagramId, version: { key, name, status } })`                                                                     |
| binding         | `binding:<diagram>`                          | `binding:<diagram>:initiative:<name>`, read as the root binding overlaid with its own entries                                        |

Overlaying the root binding means elements of the root keep their canvas ids in the Version (the
Version shows them through), and a root element added after the initiative was first drawn is not
drawn twice. The engine's sync turns the merged graph into Version changes: removals hide base
elements, updates copy them (copy-on-write in the store), additions are the Version's own.

`InitiativeVersions` (pure, tested with fakes) keeps these engines for the bound diagram and the
View diagrams, creates the Version when an initiative has none (so an empty initiative is listed),
updates its name and status, removes the plugin's Versions whose initiative is gone, and routes
canvas changes: an edit on a diagram showing an initiative's Version goes to that initiative's
engine; any other edit to the root engine. View diagrams stay projections: only positions flow back.

## Product from buffers

`loadProductSources` over the buffers: `opscr.workspace.yaml`, root manifests (top level), and per
`initiatives/<name>/` its manifests, lock and layout. Recomputed when the buffers change (cached by
identity).

## Actions

| Action        | Buffers                                                                                                                     |
| ------------- | --------------------------------------------------------------------------------------------------------------------------- |
| create        | `initiatives/initiative-<n>/initiative.opscr.yaml` (`status: proposed`, `displayName` localized), then the Version is shown |
| rename        | `spec.displayName` of the Initiative                                                                                        |
| delete        | the initiative's buffers dropped, its folder deleted on Save                                                                |
| merge         | `planPromote`: writes become buffer texts, deletes drop buffers (deleted on Save); refusals shown in the pane               |
| status (pane) | `spec.status`                                                                                                               |
| accept (pane) | `updateLock(initiative, conflicted keys)` written to `initiative.lock`                                                      |

Save writes changed buffers and deletes dropped files (`PluginFolder.remove`, recursive for a
folder). Promote in the browser does not check git; the pane asks the architect to commit.
