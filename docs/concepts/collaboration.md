# Collaboration

Live sessions (`src/features/collaboration/` + `server/`) are **optional and additive**:
Structura works fully offline, and turning collaboration on must never change what the app can do
alone. The decision behind the shape is [ADR-0011](../adr/0011-collaboration-server-authority.md);
the wire contract is [collab-protocol-v3.md](../collab-protocol-v3.md).

## Who owns the diagram

- **Outside a session, the host's workspace.** A session starts by seeding a room from the host's
  diagram.
- **During a session, the room in the relay's store.** The relay orders every edit (gapless room
  versions) and sends each accepted one to everyone, the sender included. Equal versions therefore
  mean equal state.
- **The host keeps the latest copy.** It applies every entry like any participant, so when the
  session ends its local diagram already holds the result, persisted through the normal storage
  port.

## Server

`server/src/collab/`:

- `relay.ts`: session handlers. A relay holds sockets and nothing it cannot lose.
- `store/`: the `RoomStore` interface and its two implementations.
  - `memory.ts`: single instance; also the executable reference.
  - `redis.ts` + `lua/`: any number of relays share rooms. Each patch is one atomic script; a
    per-room Stream carries order and resume; pub/sub carries presence.
- `merge.ts`: the merge rules.
  - field-level last-writer-wins;
  - removal wins over an edit composed before it;
  - fields guarded by a soft lock are writable only by its holder.

  `apply.lua` implements the same rules. `store/__fixtures__/merge.fixtures.ts` holds both stores
  to them.
- `protocol.ts`: messages and guards, imported by the browser through `@collab-protocol`.

## Client

`src/features/collaboration/sync/`:

- **`CollabClient`**: the socket as a state machine (`connecting → seeding | joining → ready ⇄
  reconnecting → closed`). "Ready" has exactly one entry: the room state arriving, as a catch-up
  or a snapshot.
- **`StoreBridge`**: connects one diagram in the store.
  - Local edits are captured as field-level diffs and sent at most every 100 ms.
  - Remote entries are applied as they arrive, never on animation frames, so a background tab
    stays current.
  - Remote entries are written through a store update that skips undo history and touches only
    synchronised fields: never folder, viewport or timestamps.
- **`rebase.ts`**: optimistic editing. Unconfirmed local patches sit on top of the confirmed
  state and are re-applied after every entry, so your own in-flight edit never snaps back. A
  patch the relay refuses (a lock, a removal) reverts.
- **`CollabSession`**: wires those two to presence and status in the collaboration store.

Undo stays local. A peer's entry is also applied to this diagram's undo checkpoints, so undo
reverts only your own work.

## Session lifecycle

- **Host leaves on purpose.** The session ends for everyone. Guests can import their copy.
- **Host drops.** The room keeps working. Guests see "reconnecting" and can keep editing. After 30
  s without the host, the session closes. A reload of the host tab resumes within that window,
  through the `hostToken` in `sessionStorage`.
- **Guest drops.** It resumes from its version when it can vouch for its state, otherwise it gets
  the snapshot. Unconfirmed local edits are discarded.
- **Storage loses a room.** Every client is told to reconnect. The host reseeds from its copy and
  the guests rejoin.

## Presence

- **Cursors**: coalesced per relay every 50 ms; lossy under backpressure.
- **Selection**: shown on the element.
- **Soft locks**: dragging a node or editing its name or description takes a 3 s lock, renewed
  while the gesture lasts. Peers see who holds it (a dashed ring with a lock badge), and the canvas
  will not start a drag on a held node. Everything else is last-writer-wins per field.

## Not synced

Undo history, viewport, save status and LLM threads are not synced. Rooms are per diagram.
Workspace-level data (folders, the service catalog, a future model index) is outside sessions, and
extending them there needs its own decision.
