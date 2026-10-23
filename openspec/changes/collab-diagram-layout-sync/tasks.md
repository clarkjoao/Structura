# Tasks

## 1. Protocol and relays

- [x] 1.1 Add `direction` and `layoutSettings` to `DOC_FIELDS`, export `LEGACY_DOC_FIELDS`, and add `docFields` to `joined` in `server/src/collab/protocol.ts`; send it from the Node relay. Verify with relay tests: `joined` declares the fields, and a patch with `direction` is accepted.
- [x] 1.2 Do the same in the Go relay (`DocFields`, `Joined.DocFields`, relay and serverless). Verify with `go test ./...`.

## 2. Client

- [x] 2.1 Make `diagramToState` take a field allowlist, and make `applyStateToDiagram` and `applyPatchToCheckpoint` handle the new fields (sanitised). Verify with diagramState tests.
- [x] 2.2 Give `StoreBridge` its allowlist and `setDocFields`, and wire `joined.docFields` → CollabSession → bridge and `collab.store.syncsDiagramLayout`. Verify with StoreBridge tests: legacy sends nothing new, current sends the direction after joining, remote direction is applied.
- [x] 2.3 Lock the Canvas direction switch only against a relay without the capability. Verify by typecheck and review.

## 3. Docs and checks

- [x] 3.1 Update `docs/collab-protocol-v3.md` and ADR-0013. Verify by review.
- [x] 3.2 Run `npm run typecheck`, `npm run lint`, `npm run test`, `npm run fallow:check`, and the server and Go test suites. Verify all of them are green.
