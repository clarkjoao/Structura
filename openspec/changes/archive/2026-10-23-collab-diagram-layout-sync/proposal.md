# Proposal

## Why

Two kinds of diagram data are not synchronised in a live session:

- the reading direction (ADR-0013);
- the arrange settings: density, gaps and the automatic mode.

The relays accept only a fixed allowlist of `doc` fields and refuse a patch with any other, so
the direction switch had to be disabled during a session. This is ADR-0013's step 4:

- the relays learn the two fields;
- the client sends them only to a relay that says it knows them;
- the switch works in a session.

## What Changes

- **Two new doc fields.** `direction` (`"TB"` or `null`) and `layoutSettings` (an object, or
  `null`) are added to the doc fields in the shared protocol and in the Go relay.
- **A capability on `joined`.** It now carries `docFields`, the doc fields this relay accepts,
  from both relays: Node, Go long-lived and Go serverless.
- **The client never sends a field the relay did not declare.** It assumes the original seven
  fields when `docFields` is absent (an older relay). The host seeds with the original fields
  and sends the new ones in a normal patch once `joined` declares them, so a seed is never
  refused by an older relay.
- **Remote values are applied and undone correctly.** A remote `direction` / `layoutSettings`
  is applied (sanitised). Undo checkpoints carry a peer's change of either, so undo reverts only
  the local user's own work.
- **The direction switch is disabled only against a relay that does not declare the field**,
  with the existing explanation.
- **Docs.** `docs/collab-protocol-v3.md` documents the fields and the capability. ADR-0013
  records step 4.

## Non-Goals

- Bumping the protocol version. The change is additive and negotiated by `docFields`.
- Syncing the per-browser canvas preferences.
- A migration for rooms already open during the deploy. They keep the old allowlist until the
  relay restarts or the room is recreated, and the gate handles that.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `collab-sync`: the diagram's reading direction and arrange settings are synchronised, behind
  a relay capability.

## Impact

- `server/src/collab/protocol.ts`, `relay.ts`, and the Node relay tests.
- `go-server/internal/protocol` (types, messages), `relay/relay.go`, `serverless/handler.go`,
  and the Go tests.
- `src/features/collaboration/sync/` (`diagramState.ts`, `StoreBridge.ts`, `CollabClient.ts`,
  `CollabSession.ts`) and `store/collab.store.ts`.
- `src/features/canvas/Canvas.tsx`.
- `docs/collab-protocol-v3.md`, ADR-0013.
