# Collab Architecture Study — Structura

> **Status:** Analysis Complete
> **Date:** 2026-09-03
> **Author:** Architecture Study

---

## 1. Current Architecture

### 1.1 Overview

The collaboration system uses a **WebSocket relay** model (not Yjs/CRDT as documented in `docs/concepts/collaboration.md` — see discrepancy below).

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENTS                                   │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐            │
│  │  Host   │  │ Guest 1 │  │ Guest 2 │  │ Guest N │            │
│  │ (owner) │  │         │  │         │  │         │            │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘            │
│       │             │            │            │                  │
│       └─────────────┴─────┬──────┴────────────┘                  │
│                          │                                        │
└──────────────────────────┼────────────────────────────────────────┘
                           │ WebSocket
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SERVER (Relay)                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Room Map                                               │    │
│  │  roomId → { hostWs, hostUser, snapshot, guests }        │    │
│  │                                                         │    │
│  │  Socket State Map                                       │    │
│  │  ws → { roomId, clientId, role, awaitingPong }         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Responsibilities:                                               │
│  - Forward patches between clients                              │
│  - Store current snapshot (in-memory only)                       │
│  - Track peer presence                                          │
│  - Heartbeat monitoring                                         │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Current Message Protocol

| Message Type | Direction | Purpose |
|--------------|-----------|---------|
| `host:join` | Client → Server | Host creates/joins a room |
| `host:ack` | Server → Client | Server confirms host join |
| `guest:join` | Client → Server | Guest joins existing room |
| `session:init` | Server → Client | Initial state sent to guest |
| `host:patch` | Client → Server | Host sends state update |
| `guest:patch` | Client → Server | Guest sends state update |
| `session:patch` | Server → Client | Broadcast state update |
| `peer:cursor` | Client ↔ Server | Cursor/presence update |
| `peer:joined` | Server → Client | New peer notification |
| `peer:left` | Server → Client | Peer departure notification |
| `host:close` | Client → Server | Host closes session |
| `session:closed` | Server → Client | Session terminated |
| `host:reconnecting` | Server → Client | Host disconnected (guests) |
| `host:reconnected` | Server → Client | Host reconnected |
| `error` | Server → Client | Error notification |
| `ping/pong` | Bidirectional | Heartbeat |

### 1.3 Files and Components

```
server/src/
├── collab.ts        # WebSocket server, room management, message handling
├── index.ts         # Server entry point, attaches collab to HTTP
├── config.ts        # Configuration (WS_PATH, SSL, proxy)
└── server.ts        # HTTP/HTTPS server factory

src/features/collaboration/
├── hooks/
│   ├── useCollab.ts         # WebSocket lifecycle, reconnection
│   ├── useCollabStoreSync.ts # Store→patch diff, remote patch application
│   └── useCollabHighlight.ts # Element editing highlight
├── store/
│   └── collab.store.ts      # Session/peer state (Zustand)
├── components/
│   ├── CollabProvider.tsx   # Context wrapper
│   ├── CollabRoom.tsx       # Full-screen collab view
│   ├── CollabRoomToolbar.tsx # Toolbar with status/controls
│   ├── CollabStartModal.tsx  # Host: create session
│   ├── CollabJoinModal.tsx   # Guest: join session
│   ├── CollabCursors.tsx    # Remote cursor overlay
│   ├── CollabToolbar.tsx     # Toolbar button
│   ├── CollabStatusIndicator.tsx
│   ├── CollabSessionClosedModal.tsx
│   ├── CollabEditingWarning.tsx
│   └── CollabStatusIndicator.tsx
├── types.ts          # CollabUser, CollabSession, PeerState, CollabStatus
└── utils/
    ├── collab.utils.ts       # Room ID generation, server testing
    ├── collab-colors.ts     # Peer color palette
    ├── collab-preferences.ts # localStorage prefs
    └── copy-text.ts         # Clipboard

src/features/canvas/
├── components/
│   └── CollabPeerPresence.tsx # Peer presence on nodes
├── edges/
│   └── overlays/
│       └── CollabEdgeHighlight.tsx
└── hooks/
    └── usePeerOnNode.ts
```

### 1.4 Data Flow

```
┌──────────────┐
│ User Action  │
└──────┬───────┘
       ▼
┌──────────────────┐
│ Zustand Store   │ ← useDiagramStore
│ (components,    │
│  nodeLayouts,   │
│  etc.)          │
└──────┬─────────┘
       │ subscribe
       ▼
┌──────────────────────────┐
│ useCollabStoreSync      │
│ - pickTrackedState()    │  ← Captures previous state
│ - diffPatch()           │  ← Computes diff
│ - sendPatch()           │  ← Sends to WebSocket
└──────┬─────────────────┘
       │ WebSocket
       ▼
┌──────────────────────────┐
│ Server (collab.ts)      │
│ - applyPatch()           │  ← Merges into room.snapshot
│ - broadcastToRoom()      │  ← Sends to all peers
└──────┬─────────────────┘
       │ WebSocket
       ▼
┌──────────────────────────┐
│ Remote Clients          │
│ - onPatch()             │  ← Receives patch
│ - useDiagramStore       │  ← Applies to local store
│   .setState()           │
└──────────────────────────┘
```

### 1.5 Critical Discrepancy: Documentation vs Implementation

**Documentation claims:**
> "CRDT sync via Yjs. Diagram state replicates as a Yjs document"

**Actual implementation:**
- Uses raw `ws` WebSocket library
- No Yjs dependency in server
- Simple patch/merge model (last-write-wins by key)
- No CRDT, no OT

**Impact:** The docs describe the *intended* architecture, but the current implementation is a simpler relay with basic patches.

---

## 2. Problems Found

### 2.1 Room Capacity (Critical)

**Problem:** `MAX_ROOM_PEERS = 5` (1 host + 4 guests)

**Current implementation in `server/src/collab.ts:33`:**
```typescript
const MAX_ROOM_PEERS = 5; // 1 host + 4 guests
```

**Requested:** Support 15 simultaneous users.

**Race condition vulnerability:**
```typescript
// In handleGuestJoin:
if (roomPeerCount(room) >= MAX_ROOM_PEERS) {
  sendError(ws, "room_full", "Room is full", { close: true });
  return;
}
// Gap here allows race condition
room.guests.set(clientId, { ws, user: normalizedUser });
```

Two guests joining simultaneously when 14 exist could both pass the check, resulting in 16 participants.

### 2.2 No Operation Versioning

**Problem:** No sequence numbers, operation IDs, or version tracking.

**Current state:** Each patch is just a partial state object. No way to:
- Detect duplicate operations
- Detect gaps in sequence
- Replay missed operations
- Order operations deterministically

**Example current patch:**
```typescript
// What server sends
{
  type: "session:patch",
  patch: { nodeLayouts: { "node-1": { x: 100, y: 200 } } }
}
```

**What's missing:**
- No `operationId`
- No `baseVersion`
- No `sequenceNumber`
- No `timestamp`
- No `clientId` on the operation itself

### 2.3 Last-Write-Wins Conflicts

**Problem:** Simple object merge means last write wins for any key.

```typescript
// In applyPatch():
function applyPatch(snapshot: Record<string, unknown>, patch: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(patch)) {
    snapshot[key] = value;  // Simple overwrite
  }
}
```

**Conflict scenarios:**

1. **Same node, different properties:** Works fine
   - User A updates `nodeLayouts["n1"].x`
   - User B updates `nodeLayouts["n1"].y`
   - Both merge correctly

2. **Same node, same property:** Last write wins
   - User A sets `nodeLayouts["n1"].x = 100`
   - User B sets `nodeLayouts["n1"].x = 200` (100ms later)
   - Final: `x = 200` — acceptable for dragging

3. **Remove vs update:**
   - User A removes `nodes["n1"]`
   - User B updates `nodes["n1"].label`
   - Final: `nodes["n1"].label = "Updated"` with `nodes["n1"]` existing
   - **BUG:** Orphaned node data remains

4. **Edge vs node removal:**
   - User A removes `nodes["n1"]`
   - User B updates `edges["e1"]` (connecting to n1)
   - Final: Edge points to deleted node
   - **BUG:** Dangling edge

### 2.4 Full State Diff Inefficiency

**Problem:** Current `diffPatch()` sends entire sub-objects, not granular changes.

```typescript
// In useCollabStoreSync.ts:
if (previous.nodeLayouts !== current.nodeLayouts) {
  patch.nodeLayouts = current.nodeLayouts;  // Entire object
}
```

**Impact during drag:**
- User moves a node
- `nodeLayouts` object changes
- Entire `nodeLayouts` (all nodes) sent as patch
- With 50 nodes, 50x more data than needed

### 2.5 No Operation Coalescing

**Problem:** Drag events fire on every animation frame.

```typescript
// In useCollabStoreSync.ts:
const flush = () => {
  const patch = diffPatch(previousState, currentState);
  if (patch) {
    sendPatchRef.current?.(patch);
  }
};
const scheduleFlush = () => {
  frame = requestAnimationFrame(flush);
};
```

**Impact:**
- ~60 patches/second during drag
- Server receives, applies, broadcasts each
- All 14 other clients receive 60 updates/second
- No debouncing or throttling

### 2.6 Reconnection Gap

**Problem:** Guest reconnect after host disconnect results in data loss.

**Flow:**
1. Host disconnects
2. Guests see "host:reconnecting" (10 second timer)
3. If host doesn't reconnect in 10s, room closes
4. Guest tries to rejoin → gets fresh state
5. **Guest's local changes during disconnect are lost**

**No operation log to replay missed operations.**

### 2.7 No Client-Side Operation Queue

**Problem:** Operations sent while disconnected are lost.

```typescript
// In useCollab.ts:
const sendPatch = useCallback((patch: CollabPatch) => {
  if (!roomId) return;
  const type = isHost ? "host:patch" : "guest:patch";
  sendRaw({ type, roomId, patch });
  // No queue, no retry, no ACK tracking
}, ...);
```

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-01 | Support up to 15 simultaneous users per room | **Critical** |
| FR-02 | Server enforces 15-user limit | **Critical** |
| FR-03 | Clear "room full" error for user 16+ | **Critical** |
| FR-04 | Operations, not full state, transmitted | **Critical** |
| FR-05 | Server maintains operation order | **High** |
| FR-06 | Clients converge to same state | **High** |
| FR-07 | Duplicate operations handled safely | **High** |
| FR-08 | Late-joining clients sync correctly | **Medium** |
| FR-09 | Reconnection recovers missed operations | **Medium** |
| FR-10 | Conflict resolution rules are explicit | **Medium** |

### 3.2 Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-01 | Drag operation bandwidth | < 10 ops/sec per user |
| NFR-02 | Patch payload size | < 1KB per operation |
| NFR-03 | Operation latency | < 100ms (local network) |
| NFR-04 | Reconnection time | < 5s after network restore |
| NFR-05 | Operation history retention | 1000 operations per room |

---

## 4. Alternatives Analysis

### 4.1 JSON Patch (RFC 6902)

**Description:** Send operations like `{"op": "replace", "path": "/nodes/n1/x", "value": 100}`

**Pros:**
- Standard format
- Clear semantics
- Libraries available

**Cons:**
- Complex for nested structures
- React Flow state is deeply nested
- Requires path-based addressing
- Doesn't handle move operations well

**Verdict:** Overkill for this use case.

### 4.2 JSON Merge Patch (RFC 7386)

**Description:** Send partial objects that merge into existing state.

**Current implementation uses this approach.**

**Pros:**
- Simple to implement
- Easy to understand
- Works for non-conflicting changes

**Cons:**
- No operation semantics
- Last-write-wins only
- No granularity control
- Same problems as current approach

**Verdict:** Keep as base, add operation IDs.

### 4.3 Semantic Operations

**Description:**
```typescript
{ type: "UPDATE_NODE_LAYOUT", nodeId: "n1", x: 100, y: 200 }
{ type: "UPDATE_NODE_DATA", nodeId: "n1", label: "New Label" }
{ type: "ADD_NODE", node: {...} }
{ type: "REMOVE_NODE", nodeId: "n1" }
{ type: "ADD_EDGE", edge: {...} }
{ type: "REMOVE_EDGE", edgeId: "e1" }
```

**Pros:**
- Clear intent
- Easier conflict resolution per operation type
- Server can validate operations
- Natural for CRDT/OT integration

**Cons:**
- Requires client and server to understand all operation types
- Migration if new operations added
- More complex than simple patches

**Verdict:** **Recommended as enhancement to current model.**

### 4.4 Operational Transformation (OT)

**Description:** Transform concurrent operations based on their relative order.

**Pros:**
- Strong consistency guarantees
- Industry-proven (Google Docs, Firepad)
- Handles concurrent edits well

**Cons:**
- Significant implementation complexity
- Server must transform operations
- Debugging is hard
- Yjs is essentially OT under the hood

**Verdict:** Not needed for 15 users with last-write-wins on most operations.

### 4.5 CRDT (Yjs, Automerge)

**Description:** Data structures that merge automatically without conflict.

**Current docs claim this approach.**

**Pros:**
- Strong eventual consistency
- Offline-first capable
- Battle-tested (Yjs)
- Handles concurrent edits

**Cons:**
- Significant complexity increase
- Larger state vectors
- Yjs binary format requires library on server
- Server becomes stateful (must store CRDT doc)
- Overkill for 15-user real-time collab

**Verdict:** Consider only if offline-first is a hard requirement. Current architecture is local-first on client, relay on server.

### 4.6 Server-Authoritative Operation Log

**Description:**
1. Client sends operation with local ID
2. Server assigns sequence number
3. Server broadcasts to all clients
4. Clients apply in sequence order
5. Server maintains operation history for resync

**Pros:**
- Simple to understand
- Deterministic ordering
- Easy debugging
- Natural resync mechanism
- Compatible with current model

**Cons:**
- Requires all clients to process same sequence
- Server must handle out-of-order receipt
- Gap detection needed

**Verdict:** **Recommended. Best balance of simplicity and correctness for 15 users.**

---

## 5. Recommended Architecture

### 5.1 Chosen Approach: Server-Authoritative Operation Log

**Rationale:**
1. **Sufficient for 15 users** — No complex concurrent editing that requires OT or CRDT
2. **Last-write-wins is acceptable** — For diagram nodes, last position wins
3. **Simple to implement** — Extends current model with sequence numbers
4. **Easy to debug** — Operations are human-readable
5. **Natural resync** — Server has full operation history
6. **Low overhead** — Sequence numbers add minimal payload

### 5.2 Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                          SERVER                                        │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Room State                                                      │  │
│  │  {                                                               │  │
│  │    roomId,                                                       │  │
│  │    participants: Map<clientId, Participant>,                      │  │
│  │    canonicalSnapshot: CollabSnapshot,  // Current truth           │  │
│  │    operationLog: Operation[],           // For resync             │  │
│  │    version: number,                   // Sequence counter         │  │
│  │    hostWs,                                                    │  │
│  │    guests: Map<clientId, Guest>                                │  │
│  │  }                                                              │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Operation Processing                                           │  │
│  │  1. Validate operation                                          │  │
│  │  2. Assign sequence number                                      │  │
│  │  3. Apply to canonical snapshot                                 │  │
│  │  4. Append to operation log                                     │  │
│  │  5. Broadcast operation to all clients                          │  │
│  │  6. Trim log if > MAX_LOG_SIZE                                 │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              │ Operation
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                          CLIENT                                        │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Operation Queue                                                │  │
│  │  - Pending operations (not yet ACKed)                          │  │
│  │  - Sent operations (awaiting ACK)                               │  │
│  │  - Applied operations (confirmed by server)                      │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                              │                                         │
│                              ▼                                         │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Local Store (Zustand)                                          │  │
│  │  - Mirrors canonical state                                      │  │
│  │  - Applies operations in sequence order                         │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

### 5.3 State Canonicality

```
[CLIENT]                              [SERVER]
   │                                      │
   │  Intent: Move node to (100, 200)    │
   │  ─────────────────────────────────► │  1. Validate
   │                                      │  2. Assign seq=42
   │                                      │  3. Apply to canonical
   │                                      │  4. Broadcast
   │◄─────────────────────────────────── │  { type: OP, seq: 42, ... }
   │                                      │
   │  Apply operation 42                 │
   │  (only if seq matches next expected) │
   │                                      │
   ▼                                      ▼
```

**Canonical state lives on SERVER.** Clients maintain local replicas that converge to server state.

---

## 6. Proposed Protocol

### 6.1 Message Types

| Type | Direction | Purpose |
|------|-----------|---------|
| `JOIN` | Client → Server | Request to join room |
| `JOIN_ACCEPTED` | Server → Client | Join approved, includes initial state + version |
| `JOIN_REJECTED` | Server → Client | Join rejected (full, not found, etc.) |
| `OP` | Bidirectional | Operation broadcast |
| `ACK` | Server → Client | Acknowledgment of client operation |
| `SYNC_REQUEST` | Client → Server | Request resync from version N |
| `SYNC_RESPONSE` | Server → Client | Full state + operations since N |
| `PEER_JOINED` | Server → Clients | New participant |
| `PEER_LEFT` | Server → Clients | Participant left |
| `CURSOR` | Client → Server → Clients | Cursor/presence update |
| `ERROR` | Server → Client | Error notification |
| `PING/PONG` | Bidirectional | Heartbeat |

### 6.2 Message Schemas

```typescript
// JOIN
interface JoinRequest {
  type: "JOIN";
  roomId: string;
  user: { id: string; name: string; color: string };
  isHost: boolean;
  clientVersion: number;  // Protocol version
}

// JOIN_ACCEPTED
interface JoinAccepted {
  type: "JOIN_ACCEPTED";
  roomId: string;
  participantCount: number;
  maxParticipants: number;
  participants: Array<{ id: string; name: string; color: string; isHost: boolean }>;
  version: number;        // Current server version
  snapshot: CollabSnapshot;
  operations: Operation[]; // Operations since last snapshot
}

// JOIN_REJECTED
interface JoinRejected {
  type: "JOIN_REJECTED";
  reason: "ROOM_FULL" | "ROOM_NOT_FOUND" | "PROTOCOL_MISMATCH" | "UNAUTHORIZED";
  message: string;
}

// OP (Operation)
interface Operation {
  id: string;            // Client-generated unique ID
  clientId: string;      // Author
  seq: number;           // Server-assigned sequence (added by server)
  timestamp: number;      // Unix ms
  type: OpType;
  payload: OpPayload;
}

type OpType =
  | "UPDATE_NODE_LAYOUT"
  | "UPDATE_NODE_DATA"
  | "UPDATE_NODE_STYLE"
  | "ADD_NODE"
  | "REMOVE_NODE"
  | "ADD_EDGE"
  | "UPDATE_EDGE"
  | "REMOVE_EDGE"
  | "UPDATE_DIAGRAM"
  | "UPDATE_SCENE";

interface UpdateNodeLayoutOp {
  type: "UPDATE_NODE_LAYOUT";
  nodeId: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

interface RemoveNodeOp {
  type: "REMOVE_NODE";
  nodeId: string;
  // Cascade: also removes connected edges
}

// ACK
interface Ack {
  type: "ACK";
  operationId: string;   // Client's operation ID
  seq: number;           // Server's sequence number
  accepted: boolean;
  reason?: string;        // If not accepted
}

// SYNC_REQUEST
interface SyncRequest {
  type: "SYNC_REQUEST";
  clientId: string;
  lastVersion: number;    // Client's last known version
}

// SYNC_RESPONSE
interface SyncResponse {
  type: "SYNC_RESPONSE";
  version: number;
  snapshot?: CollabSnapshot;  // If major gap, send full state
  operations: Operation[];     // Operations since lastVersion
}

// ERROR
interface ErrorMessage {
  type: "ERROR";
  code: string;
  message: string;
  recoverable: boolean;
}
```

### 6.3 Error Codes

| Code | Meaning | Recoverable |
|------|---------|------------|
| `ROOM_FULL` | Room at 15 participants | No |
| `ROOM_NOT_FOUND` | Room doesn't exist | Retry join |
| `ROOM_CLOSED` | Room was closed | No |
| `INVALID_OPERATION` | Malformed operation | No |
| `VERSION_GAP` | Client too far behind | Sync required |
| `UNAUTHORIZED` | Not allowed in room | No |
| `RATE_LIMITED` | Too many operations | Yes, back off |

---

## 7. Versioning Strategy

### 7.1 Version Model

```typescript
interface RoomVersion {
  current: number;           // Latest sequence number
  snapshotVersion: number;   // Version when last snapshot was taken
  lastActivity: number;      // Unix timestamp
}
```

### 7.2 Operation Tracking

```typescript
interface Operation {
  id: string;          // Client-generated: "uuid-v4"
  clientId: string;    // Who sent it
  seq: number;         // Server sequence (1, 2, 3, ...)
  timestamp: number;   // When server received it
  type: OpType;
  payload: OpPayload;
}
```

### 7.3 Gap Detection & Recovery

**Client tracks:**
```typescript
interface ClientState {
  lastAckedSeq: number;      // Last sequence I know server processed
  pendingOps: Map<string, Operation>;  // My ops awaiting ACK
  appliedOps: Set<number>;    // Sequences I've applied
}
```

**On receiving OP from server:**
1. If `seq === lastAckedSeq + 1` → Apply and increment
2. If `seq > lastAckedSeq + 1` → Gap detected, request SYNC
3. If `seq <= lastAckedSeq` → Already applied, discard (idempotency)

**On ACK from server:**
1. Remove from `pendingOps`
2. Update `lastAckedSeq` to server's `seq`

### 7.4 Snapshot Strategy

```typescript
const SNAPSHOT_INTERVAL = 100;  // New snapshot every 100 operations
const MAX_LOG_SIZE = 1000;       // Keep last 1000 operations
```

**When server creates snapshot:**
- Store `snapshotVersion = currentVersion`
- Store full `CollabSnapshot`
- Keep operations after snapshotVersion for incremental sync

**New client joins:**
- If `currentVersion - snapshotVersion < 100`:
  - Send snapshot + operations since snapshot
- If gap is larger:
  - Send full snapshot + recent operations

---

## 8. Conflict Resolution

### 8.1 Resolution Rules by Operation Type

| Conflict | Resolution | Rationale |
|----------|------------|-----------|
| UPDATE_NODE_LAYOUT vs UPDATE_NODE_LAYOUT | Last-write-wins by timestamp | Position changes are ephemeral |
| UPDATE_NODE_DATA vs UPDATE_NODE_DATA | Field-level merge | User likely editing different fields |
| UPDATE_NODE_STYLE vs UPDATE_NODE_STYLE | Field-level merge | Style properties are independent |
| REMOVE_NODE vs UPDATE_NODE_* | Remove wins | Node deletion is explicit intent |
| REMOVE_NODE vs ADD_NODE (same ID) | Remove wins | Delete then recreate is user's choice |
| ADD_NODE vs ADD_NODE (same ID) | First-write-wins | ID collision, keep first |
| ADD_EDGE vs REMOVE_NODE | Edge references dead node → remove edge | Cascade cleanup |
| REMOVE_EDGE vs UPDATE_EDGE | Remove wins | Edge deletion is explicit |
| UPDATE_DIAGRAM vs UPDATE_DIAGRAM | Field-level merge | Metadata is independent |

### 8.2 Server-Side Resolution Implementation

```typescript
function applyOperation(room: Room, op: Operation): ApplyResult {
  switch (op.type) {
    case "REMOVE_NODE":
      // First, remove connected edges
      for (const [edgeId, edge] of Object.entries(room.snapshot.connections)) {
        if (edge.source === op.nodeId || edge.target === op.nodeId) {
          delete room.snapshot.connections[edgeId];
        }
      }
      // Then remove node
      delete room.snapshot.components[op.nodeId];
      delete room.snapshot.nodeLayouts[op.nodeId];
      break;

    case "ADD_NODE":
      if (room.snapshot.components[op.payload.node.id]) {
        // ID collision - reject
        return { accepted: false, reason: "NODE_EXISTS" };
      }
      room.snapshot.components[op.payload.node.id] = op.payload.node;
      if (op.payload.layout) {
        room.snapshot.nodeLayouts[op.payload.node.id] = op.payload.layout;
      }
      break;

    case "UPDATE_NODE_LAYOUT":
      const existing = room.snapshot.nodeLayouts[op.payload.nodeId];
      if (!existing) {
        // Node was deleted - ignore
        return { accepted: false, reason: "NODE_NOT_FOUND" };
      }
      room.snapshot.nodeLayouts[op.payload.nodeId] = {
        ...existing,
        ...op.payload,  // Partial update - only specified fields
      };
      break;

    // ... other operations
  }

  return { accepted: true };
}
```

### 8.3 Cascade Rules

| Action | Cascades To |
|--------|-------------|
| REMOVE_NODE | REMOVE_CONNECTED_EDGES |
| REMOVE_COMPONENT | REMOVE_CONNECTED_EDGES |
| REMOVE_EDGE | (none) |

---

## 9. Room Capacity (15 Users)

### 9.1 Definition of "Participant"

A participant is a **WebSocket connection with an authenticated user identity**.

- One user = one WebSocket connection
- Multiple tabs = multiple connections (each tab is a participant)
- Same user reconnecting = same participant (after graceful handoff)

### 9.2 Participant Limit Implementation

```typescript
const MAX_PARTICIPANTS = 15;

function handleGuestJoin(ws: WebSocket, message: JsonMessage): void {
  const room = rooms.get(roomId);
  if (!room) {
    sendError(ws, "ROOM_NOT_FOUND", "Room not found");
    return;
  }

  // Atomic check-and-set to prevent race condition
  const currentCount = countParticipants(room);
  if (currentCount >= MAX_PARTICIPANTS) {
    sendError(ws, "ROOM_FULL", `Room is full (max ${MAX_PARTICIPANTS} participants)`);
    ws.close(4001, "ROOM_FULL");
    return;
  }

  // Add participant atomically
  const clientId = ensureUniqueGuestId(room, user.id);
  room.guests.set(clientId, { ws, user: normalizedUser });

  // Broadcast to all
  broadcastToRoom(room, {
    type: "PEER_JOINED",
    participantCount: countParticipants(room),
    participant: { clientId, user: normalizedUser }
  });
}

function countParticipants(room: Room): number {
  return 1 + room.guests.size;  // Host + guests
}
```

### 9.3 Race Condition Prevention

**Scenario:** 14 participants, two users try to join simultaneously.

**Without atomic check:**
```
Thread 1: if (count >= 15) → false
Thread 2: if (count >= 15) → false
Thread 1: room.guests.set(guest1)
Thread 2: room.guests.set(guest2)
Result: 16 participants ❌
```

**With atomic check (Node.js single-threaded):**
```
Thread 1: count = 15 → REJECT ✓
Thread 2: never runs (JavaScript is single-threaded)
```

Node.js is single-threaded, so the current implementation is already safe from this specific race condition. However, for clarity and future-proofing, we should still use the explicit check pattern.

### 9.4 Reconnection Handling

```typescript
interface Participant {
  clientId: string;
  user: CollabUser;
  ws: WebSocket | null;  // null if temporarily disconnected
  lastSeen: number;
  reconnectWindow: number;  // ms until considered offline
}
```

**Host disconnection:**
- Guests see "host:reconnecting"
- 10-second window for host to reconnect
- If host reconnects with same `clientId` → restore session
- If timeout → room closes, guests notified

**Guest disconnection:**
- Server marks participant as `ws: null`
- 30-second window for reconnection
- New connection with same `clientId` → restore state
- If timeout → participant removed, peers notified

---

## 10. Performance Strategy

### 10.1 Operation Coalescing

**Problem:** Drag events fire 60 times/second.

**Solution:** Coalesce position updates on client before sending.

```typescript
// Client-side coalescing
let pendingLayoutUpdates = new Map<string, Partial<NodeLayout>>();
let coalesceFrame: number | null = null;

function scheduleCoalescedUpdate() {
  if (coalesceFrame !== null) return;

  coalesceFrame = requestAnimationFrame(() => {
    coalesceFrame = null;

    if (pendingLayoutUpdates.size === 0) return;

    // Send single operation with latest values
    sendOperation({
      type: "UPDATE_NODE_LAYOUT_BATCH",
      updates: Object.fromEntries(pendingLayoutUpdates)
    });

    pendingLayoutUpdates.clear();
  });
}

function onNodeDrag(nodeId: string, x: number, y: number) {
  pendingLayoutUpdates.set(nodeId, { x, y });
  scheduleCoalescedUpdate();
}

// Throttle: max 10 coalesced updates/second during drag
const THROTTLE_MS = 100;
```

**Result:** 60 drag events → 10 operations/second → 83% reduction

### 10.2 Server-Side Batching

```typescript
// Server batches operations per client
const clientPendingOps = new Map<string, Operation[]>();

function handleOperation(ws: WebSocket, op: Operation) {
  const state = socketStates.get(ws);
  if (!state) return;

  // Queue operation
  const queue = clientPendingOps.get(state.clientId) ?? [];
  queue.push(op);
  clientPendingOps.set(state.clientId, queue);

  // Flush queue after short delay (batch multiple ops)
  setTimeout(() => flushClientQueue(state.clientId), 16);  // ~1 frame
}

function flushClientQueue(clientId: string) {
  const queue = clientPendingOps.get(clientId);
  if (!queue || queue.length === 0) return;

  // Process queue
  for (const op of queue) {
    processOperation(op);
  }

  // Broadcast once with batch
  broadcastToRoom(room, {
    type: "OP_BATCH",
    operations: queue.map(op => op.seq)  // Just references
  });

  clientPendingOps.delete(clientId);
}
```

### 10.3 Payload Size Estimates

| Operation Type | Typical Size |
|----------------|--------------|
| UPDATE_NODE_LAYOUT | ~50 bytes |
| UPDATE_NODE_DATA | ~200 bytes |
| ADD_NODE | ~500 bytes |
| REMOVE_NODE | ~30 bytes |
| ADD_EDGE | ~300 bytes |
| UPDATE_DIAGRAM | ~100 bytes |
| OP with seq/id | +40 bytes overhead |

**With batching:** A batch of 5 drag operations = ~300 bytes vs 5 separate messages.

### 10.4 Bandwidth Estimates (15 Users)

**Assumptions:**
- 5 users actively dragging simultaneously
- 10 coalesced updates/second each
- 14 other users receiving updates

**Outbound per user:** ~500 bytes/sec (manageable)
**Total server outbound:** ~7 KB/sec (trivial for modern networks)

---

## 11. Testing Strategy

### 11.1 Unit Tests

```typescript
// collab.operation.test.ts
describe("Operation Processing", () => {
  it("assigns sequential sequence numbers");
  it("rejects duplicate operation IDs");
  it("applies UPDATE_NODE_LAYOUT correctly");
  it("applies REMOVE_NODE with edge cascade");
  it("rejects ADD_NODE with duplicate ID");
});

describe("Conflict Resolution", () => {
  it("last-write-wins on concurrent layout updates");
  it("field-merge on concurrent data updates");
  it("remove wins over update");
  it("remove connected edges when node removed");
});
```

### 11.2 Integration Tests

```typescript
// collab.integration.test.ts
describe("Room Lifecycle", () => {
  it("host can create room");
  it("guest can join room");
  it("16th guest is rejected");
  it("host disconnect triggers reconnect window");
  it("room closes after host timeout");
});

describe("Operation Propagation", () => {
  it("operations reach all participants");
  it("new joiner receives state + ops");
  it("late joiner receives full sync");
});

describe("Reconnection", () => {
  it("guest can reconnect within window");
  it("guest state preserved on reconnect");
  it("operations during disconnect are lost (known limitation)");
});
```

### 11.3 Concurrency Tests (Simulated)

```typescript
// collab.concurrency.test.ts
describe("15 Concurrent Users", () => {
  it("all 15 can join simultaneously");
  it("all 15 can send operations simultaneously");
  it("no operations lost at full capacity");
  it("operations are ordered correctly");
});

describe("Race Conditions", () => {
  it("two users joining at 14 participants");
  it("simultaneous REMOVE_NODE operations");
  it("ADD_NODE + REMOVE_NODE same ID");
  it("UPDATE during REMOVE cascade");
});
```

### 11.4 Load Test

```typescript
// collab.load.test.ts
describe("Load Test", () => {
  it("sustains 100 ops/sec from 15 users");
  it("latency < 100ms at peak load");
  it("memory stable over 10 minute run");
  it("recovers gracefully from burst");
});
```

---

## 12. Migration Plan

### 12.1 Phase 1: Room Capacity (Isolated)

**Changes:** Only `MAX_ROOM_PEERS` constant and error messages.

**Compatibility:** Fully backwards compatible. Old clients work with new server.

**Test:** Join with 15 guests, verify 16th is rejected.

### 12.2 Phase 2: Operation IDs (Additive)

**Changes:** Add `operationId` to messages, add ACK mechanism.

**Compatibility:** New server accepts old clients (ignores operationId). Old clients ignore ACK.

**New message flow:**
```
Client → Server: { type: "host:patch", patch, operationId: "uuid" }
Server → Client: { type: "ACK", operationId: "uuid", seq: 42 }
```

**Test:** Verify ACK received for every operation.

### 12.3 Phase 3: Server-Side Sequencing (Transparent)

**Changes:** Server assigns sequence numbers, broadcasts with seq.

**Compatibility:** Clients can ignore seq (for now). Server validates order.

**New message flow:**
```
Server → Clients: { type: "session:patch", patch, seq: 42, operationId: "uuid" }
```

**Test:** Verify seq numbers are sequential and monotonic.

### 12.4 Phase 4: Semantic Operations (Gradual)

**Changes:** Replace raw patches with typed operations.

**Compatibility:** Server can accept both formats. Clients migrate one by one.

**Migration path:**
1. Server accepts both `session:patch` (old) and `OP` (new)
2. Server broadcasts in new format
3. Clients update to send `OP` format
4. Old format support removed

**Test:** Mixed old/new clients in same room.

### 12.5 Phase 5: Client-Side Operation Queue

**Changes:** Client queues operations, tracks ACKs, handles gaps.

**Compatibility:** New clients only (old clients continue working).

**Test:** Disconnect/reconnect with pending operations.

### 12.6 Phase 6: Resync Mechanism

**Changes:** Add `SYNC_REQUEST` and `SYNC_RESPONSE` messages.

**Compatibility:** Old clients ignore resync (may get stale state on reconnect).

**Test:** Join room with 1000+ operations, verify correct state.

### 12.7 Phase 7: Coalescing

**Changes:** Client batches position updates, server coalesces broadcasts.

**Compatibility:** Transparent optimization.

**Test:** Drag node, verify < 15 ops/second sent.

### 12.8 Phase 8: Remove Legacy Protocol

**Changes:** Remove `session:patch`, `host:patch`, `guest:patch` messages.

**Compatibility:** Only after all clients updated.

---

## 13. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Operations lost during disconnect | Medium | Medium | Document limitation, queue for future |
| State divergence on reconnect | Low | High | Strict version checking, resync |
| Memory growth from operation log | Low | Low | Log truncation at MAX_LOG_SIZE |
| Protocol versioning complexity | Medium | Medium | Phased rollout with backwards compat |
| Performance degradation at 15 users | Low | Low | Batching + coalescing |

---

## 14. Open Questions

1. **Should we support offline editing with sync on reconnect?**
   - Would require CRDT or OT
   - Adds significant complexity
   - Not in current scope

2. **What happens to a user's work if they disconnect for >30s?**
   - Currently: work is lost
   - Options: queue operations client-side, or accept loss
   - Recommendation: Accept loss for v1

3. **Should operations be persisted to disk?**
   - Current: in-memory only
   - On server restart: all rooms lost
   - For v1: acceptable (rooms are ephemeral)

4. **Should we support room passwords?**
   - Not in current scope
   - Could add with simple shared secret

5. **How do we handle very large diagrams (>1000 nodes)?**
   - Snapshot size could be large
   - Consider delta snapshots more frequently
   - Not a concern for typical use

---

## 15. Summary

### Current State
- Simple WebSocket relay with patch-based state sync
- 5-user limit (1 host + 4 guests)
- No operation versioning or sequencing
- Last-write-wins on all conflicts
- No operation queue or coalescing

### Target State
- 15-user support with server-enforced limit
- Operation-based sync with sequence numbers
- Semantic operations with proper conflict resolution
- Server-authoritative ordering
- Client-side operation queue and coalescing
- Graceful reconnection with state recovery

### Recommended Approach
**Server-Authoritative Operation Log** — simple, sufficient, and maintainable for 15 users.

- No OT/CRDT complexity
- Deterministic ordering
- Easy debugging
- Natural resync mechanism
- Low overhead

This approach handles the requirements without over-engineering for a scale (15 users) where the simpler model is sufficient.
