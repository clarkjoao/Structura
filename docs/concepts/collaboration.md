# Collaboration

Real-time collaboration (`src/features/collaboration/` + `server/`) is
**optional and additive**: Structura works fully offline, and turning
collaboration on must never change what the app can do alone.

## Architecture

- **CRDT sync via Yjs.** Diagram state replicates as a Yjs document;
  concurrent edits merge without a central authority deciding winners.
- **The server is a relay, not a source of truth.** `server/src/collab.ts`
  forwards Yjs updates between peers in a room. It stores nothing durable —
  consistent with the local-first stance ([persistence.md](persistence.md)).
  The same optional server hosts the LLM proxy (`proxy.ts`); both are
  conveniences, not dependencies.
- **Sessions are rooms** (`CollabSession`: roomId, host flag, peers).
  Presence (`PeerState`: cursor, active element) flows through Yjs awareness,
  rendered by `CollabPeerPresence` and `usePeerOnNode`.

## Why CRDT rather than OT or locking

- No backend to run OT transformation on — a relay is all we can assume.
- Offline-first: a peer can edit disconnected and converge on reconnect.
- Yjs is the battle-tested implementation; writing merge logic for a
  diagram model by hand is a research project, not a feature.

Trade-off accepted: CRDT convergence is *syntactic*. Two peers can produce a
merged state that is structurally valid but semantically odd (e.g. both
re-parent the same node). The model's repair utilities
(`flow-repair`, parenting invariants) act as the semantic safety net after
merges.

## Scope of sync

Synced: the active diagram's model state and presence.
Not synced: undo history (local per peer — undo undoes *your* work),
viewport (each peer pans freely), save status, LLM threads.

## Interaction with the store

Collaboration observes store changes and applies remote changes back through
store mechanisms (patches in `collaboration/utils`), so history, selectors,
and rendering treat remote edits like local ones. Keep it this way: any code
path that writes state *around* the store breaks undo and persistence
invariants.

## Future considerations (tracked in vision §9)

The planned workspace-level Model Index adds a second consistency domain:
today rooms are per-diagram, but a model element rename touches many
diagrams. The architecture-model spec must decide whether the model becomes
its own Yjs document, or whether model edits stay host-authoritative while
only diagrams use CRDT. Do not extend collaboration scope before that
decision is recorded.
