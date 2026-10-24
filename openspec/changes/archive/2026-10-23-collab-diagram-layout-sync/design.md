# Design

## Context

See ADR-0013 (decision 8) and proposal.md.

- **Relay validation.** Both relays validate `doc` keys against an allowlist (`isDocField`,
  `IsDocField`), in patches and in seed and snapshot state. Doc values are opaque JSON, assigned
  whole and checked only for safe keys, so an object value such as `layoutSettings` needs no new
  validation.
- **Order of messages.** The host's seed is sent before its `joined`.
- **The client bridge.** `StoreBridge` derives the synced state with `diagramToState` and writes
  remote state with `applyStateToDiagram`. `applyPatchToCheckpoint` rebases undo checkpoints for
  entity patches only.

## Goals / Non-Goals

**Goals:**

- No refused patch or seed against an older relay.
- Undo semantics unchanged: a peer's change is never undone by the local user.

**Non-Goals:**

- See the proposal.

## Decisions

### 1. The capability is the declared field list, on `joined`

`joined.docFields: string[]` comes from every relay. It is a list rather than a version so
later fields can follow the same path.

- `created` is not used. Its host already sends the seed before `joined`, and the seed is kept
  to the original fields (decision 2), so `joined` is early enough.
- `LEGACY_DOC_FIELDS` (the original seven) lives in the shared protocol as the fallback.

### 2. A field allowlist inside the bridge

- `diagramToState(diagram, fields)` includes `direction` (`"TB"` or `null`) and
  `layoutSettings` (the stored object or `null`) only when `fields` has them.
- `StoreBridge` holds the allowlist, which starts as the legacy set.
- `setDocFields(fields)` replaces it and schedules a flush. Its capture then sees the new
  fields as a local change and sends them once: the host's direction reaches the room right
  after `joined`. A guest's bridge is created with the session's current set.

### 3. Applying and rebasing

- `applyStateToDiagram` applies a field only when it is present in `doc`. An absent field (an
  older relay, or a room nobody has written it in) leaves the local value alone. `null` clears
  it.
- Values are sanitised: `direction` must be `"TB"`, and settings go through
  `normalizeLayoutSettings`.
- `applyPatchToCheckpoint` also carries a patch's `direction` / `layoutSettings` into the
  checkpoint, which `DiagramSnapshot` already stores.

### 4. The lock reads the collab store

`collab.store` gains `syncsDiagramLayout`, set from `joined.docFields`. The Canvas locks the
direction switch only while a session is active and `syncsDiagramLayout` is false.

## Risks / Trade-offs

- **[Risk]** A room created on an old relay and resumed on a new one. → The allowlist is
  per-relay code, not per-room state, so the new relay accepts the fields at once.
- **[Trade-off]** The host's first patch after `joined` takes a version even when it only sets
  `null` values. This is accepted: it happens once per session.
