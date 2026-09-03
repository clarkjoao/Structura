/**
 * Integration tests for the collaboration server.
 * Uses real WebSocket connections to exercise the wire protocol.
 *
 * IMPORTANT: These tests use REAL timers throughout. waitForMessage relies on
 * setTimeout to resolve the slow-path promise, so fake timers would break it.
 */
import { createServer, type Server as HttpServer } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { attachCollabServer } from "./collab.js";

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

interface TestClient {
  ws: WebSocket;
  /** Messages received by this client that are not yet consumed. */
  sentMessages: unknown[];
  roomId: string;
}

let httpServer: HttpServer;
let collabHandle: { shutdown: () => Promise<void> };
let serverPort: number;
const TEST_ROOM = "test-room-collab";

beforeAll(async () => {
  httpServer = createServer();
  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => resolve());
  });
  const addr = httpServer.address();
  serverPort = typeof addr === "object" && addr ? addr.port : 0;
  collabHandle = attachCollabServer(httpServer);
});

afterAll(async () => {
  await collabHandle.shutdown();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

/** Pending (type, resolve, reject) tuples keyed by socket. */
const pendingMatchers = new WeakMap<
  WebSocket,
  Array<{
    types: string[];
    resolve: (msg: unknown) => void;
    reject: (err: unknown) => void;
  }>
>();

function connectClient(roomId: string): Promise<TestClient> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${serverPort}/ws`);
    ws.setMaxListeners(9999);
    const client: TestClient = { ws, sentMessages: [], roomId };

    ws.on("open", () => resolve(client));
    ws.on("error", reject);

    ws.on("message", (data) => {
      let msg: unknown;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        msg = { raw: data.toString() };
      }
      client.sentMessages.push(msg);

      // Try to satisfy any pending matcher with this newly arrived message.
      // Scan all matchers — the message may satisfy one registered by a
      // previous waitForMessage call whose fast path found nothing.
      const matchers = pendingMatchers.get(ws) ?? [];
      for (let i = 0; i < matchers.length; i++) {
        const m = matchers[i];
        if (m.types.includes((msg as Record<string, unknown>)?.type as string)) {
          matchers.splice(i, 1);
          client.sentMessages.pop(); // consume the message we just pushed
          m.resolve(msg);
          return;
        }
      }
    });
  });
}

/**
 * Returns the next message of any of the given types received by the client.
 * Uses a fast path (message already in sentMessages) and a slow path (setTimeout).
 * **Always uses real timers** — fake timers would make the slow path hang.
 */
function waitForMessage(
  client: TestClient,
  type: string | string[],
  timeoutMs = 30_000,
): Promise<unknown> {
  const types = Array.isArray(type) ? type : [type];

  // Fast path: scan all unconsumed messages for a type match
  for (let i = 0; i < client.sentMessages.length; i++) {
    const msg = client.sentMessages[i];
    if (types.includes((msg as Record<string, unknown>)?.type as string)) {
      client.sentMessages.splice(i, 1); // consume
      return Promise.resolve(msg);
    }
  }

  // Slow path: register a matcher for the next incoming message
  return new Promise((resolve, reject) => {
    if (!pendingMatchers.has(client.ws)) pendingMatchers.set(client.ws, []);
    const matchers = pendingMatchers.get(client.ws)!;
    matchers.push({ types, resolve, reject });

    // Use real setTimeout — fake timers would prevent this from ever firing
    setTimeout(() => {
      const idx = matchers.findIndex((m) => m.resolve === resolve);
      if (idx !== -1) matchers.splice(idx, 1);
      reject(
        new Error(
          `Timed out waiting for ${types.join("/")} after ${timeoutMs}ms. ` +
            `Received: ${JSON.stringify(client.sentMessages.map((m) => (m as Record<string, unknown>)?.type))}`,
        ),
      );
    }, timeoutMs);
  });
}

function makeSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    diagramId: TEST_ROOM,
    diagramName: "Test Diagram",
    level: "context",
    components: {},
    connections: {},
    flows: {},
    nodeLayouts: {},
    edgeLayouts: {},
    iconLibrary: {},
    scenes: {},
    activeSceneId: null,
    compareSceneId: null,
    ...overrides,
  };
}

function makeUser(index: number) {
  return {
    id: `user-${index}`,
    name: `User ${index}`,
    color: `#${index.toString(16).padStart(6, "0")}`,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("collaboration server integration", () => {
  // -------------------------------------------------------------------------
  // 1. Capacity: 1 host + 14 guests = 15; 16th guest gets room_full error
  // -------------------------------------------------------------------------
  it("accepts 1 host + 14 guests, rejects 15th guest with room_full", async () => {
    const hostClient = await connectClient(TEST_ROOM);
    hostClient.ws.send(
      JSON.stringify({
        type: "host:join",
        protocol: 2,
        roomId: TEST_ROOM,
        diagramId: TEST_ROOM,
        user: makeUser(0),
        snapshot: makeSnapshot(),
      }),
    );
    await waitForMessage(hostClient, "host:ack");

    const guestClients: TestClient[] = [];
    for (let i = 1; i <= 14; i++) {
      const guest = await connectClient(TEST_ROOM);
      guest.ws.send(
        JSON.stringify({ type: "guest:join",
        protocol: 2, roomId: TEST_ROOM, user: makeUser(i) }),
      );
      await waitForMessage(guest, "session:init");
      guestClients.push(guest);
    }

    // 15th guest should be rejected with room_full
    const guest15 = await connectClient(TEST_ROOM);
    let errorReceived: Record<string, unknown> | null = null;
    guest15.ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === "error") errorReceived = msg as Record<string, unknown>;
    });

    guest15.ws.send(
      JSON.stringify({ type: "guest:join",
        protocol: 2, roomId: TEST_ROOM, user: makeUser(15) }),
    );

    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 2000);
      guest15.ws.on("close", () => {
        clearTimeout(timer);
        resolve();
      });
    });

    expect(errorReceived).not.toBeNull();
    expect(errorReceived!.code).toBe("room_full");

    guest15.ws.close();
    guestClients.forEach((c) => c.ws.close());
    hostClient.ws.close();
  });

  // -------------------------------------------------------------------------
  // 2. Error codes: guest in nonexistent room receives room_not_found
  // -------------------------------------------------------------------------
  it("sends room_not_found code to guest joining nonexistent room", async () => {
    const client = await connectClient("nonexistent-room");

    client.ws.send(
      JSON.stringify({ type: "guest:join",
        protocol: 2, roomId: "nonexistent-room", user: makeUser(99) }),
    );

    const errorReceived = (await waitForMessage(client, "error")) as { code?: string };
    expect(errorReceived.code).toBe("room_not_found");

    client.ws.close();
  });

  // -------------------------------------------------------------------------
  // 3. Versioning: room starts at version 0, each patch increments
  // -------------------------------------------------------------------------
  it("starts at version 0 and increments on each patch", async () => {
    const hostClient = await connectClient(TEST_ROOM + "-v");
    hostClient.ws.send(
      JSON.stringify({
        type: "host:join",
        protocol: 2,
        roomId: TEST_ROOM + "-v",
        diagramId: TEST_ROOM + "-v",
        user: makeUser(0),
        snapshot: makeSnapshot(),
      }),
    );
    const ack = (await waitForMessage(hostClient, "host:ack")) as { version?: number };
    expect(ack.version ?? 0).toBe(0);

    // First patch
    hostClient.ws.send(
      JSON.stringify({
        type: "host:patch",
        roomId: TEST_ROOM + "-v",
        patch: { nodeLayouts: { "node-1": { x: 100, y: 200 } } },
        version: ack.version ?? 0,
      }),
    );
    const ack1 = (await waitForMessage(hostClient, "OP_ACK")) as { version?: number };
    expect(ack1.version).toBe(1);

    // Second patch
    hostClient.ws.send(
      JSON.stringify({
        type: "host:patch",
        roomId: TEST_ROOM + "-v",
        patch: { nodeLayouts: { "node-2": { x: 300, y: 400 } } },
        version: ack1.version!,
      }),
    );
    const ack2 = (await waitForMessage(hostClient, "OP_ACK")) as { version?: number };
    expect(ack2.version).toBe(2);

    hostClient.ws.close();
  });

  // -------------------------------------------------------------------------
  // 4. Version gap (B2): late patch is still applied (not rejected)
  // -------------------------------------------------------------------------
  it("applies patch when client version lags (no SYNC_REQUIRED rejection)", async () => {
    const hostClient = await connectClient(TEST_ROOM + "-vgap");
    hostClient.ws.send(
      JSON.stringify({
        type: "host:join",
        protocol: 2,
        roomId: TEST_ROOM + "-vgap",
        diagramId: TEST_ROOM + "-vgap",
        user: makeUser(0),
        snapshot: makeSnapshot(),
      }),
    );
    await waitForMessage(hostClient, "host:ack");

    hostClient.ws.send(
      JSON.stringify({
        type: "host:patch",
        roomId: TEST_ROOM + "-vgap",
        patch: { nodeLayouts: { existing: { x: 50 } } },
        version: 0,
      }),
    );
    await waitForMessage(hostClient, "OP_ACK");

    // Guest joins at version 1
    const guestClient = await connectClient(TEST_ROOM + "-vgap");
    guestClient.ws.send(
      JSON.stringify({ type: "guest:join",
        protocol: 2, roomId: TEST_ROOM + "-vgap", user: makeUser(1) }),
    );
    await waitForMessage(guestClient, "session:init");

    // Guest sends patch with stale version (0 instead of 1) — B2 fix: applied
    guestClient.ws.send(
      JSON.stringify({
        type: "guest:patch",
        roomId: TEST_ROOM + "-vgap",
        patch: { nodeLayouts: { lateNode: { x: 999 } } },
        version: 0,
      }),
    );
    const ack = (await waitForMessage(guestClient, "OP_ACK")) as { accepted?: boolean };
    expect(ack.accepted).toBe(true);

    guestClient.ws.close();
    hostClient.ws.close();
  });

  // -------------------------------------------------------------------------
  // 5. Sync replay: sync:request returns only ops newer than baseVersion
  // -------------------------------------------------------------------------
  it("sync:request returns only ops newer than baseVersion", async () => {
    const hostClient = await connectClient(TEST_ROOM + "-sync");
    hostClient.ws.send(
      JSON.stringify({
        type: "host:join",
        protocol: 2,
        roomId: TEST_ROOM + "-sync",
        diagramId: TEST_ROOM + "-sync",
        user: makeUser(0),
        snapshot: makeSnapshot(),
      }),
    );
    await waitForMessage(hostClient, "host:ack");

    for (let v = 0; v < 5; v++) {
      hostClient.ws.send(
        JSON.stringify({
          type: "host:patch",
          roomId: TEST_ROOM + "-sync",
          patch: { nodeLayouts: { [`n${v}`]: { x: v } } },
          version: v,
        }),
      );
      await waitForMessage(hostClient, "OP_ACK");
    }

    // Guest joins and requests sync from version 2 (wants ops 3, 4, 5)
    const guestClient = await connectClient(TEST_ROOM + "-sync");
    guestClient.ws.send(
      JSON.stringify({ type: "guest:join",
        protocol: 2, roomId: TEST_ROOM + "-sync", user: makeUser(1) }),
    );
    await waitForMessage(guestClient, "session:init");

    guestClient.ws.send(
      JSON.stringify({ type: "sync:request", roomId: TEST_ROOM + "-sync", baseVersion: 2 }),
    );

    const syncComplete = (await waitForMessage(guestClient, "SYNC_COMPLETE")) as {
      version?: number;
      operations?: Array<{ version: number }>;
    };
    expect(syncComplete.version).toBe(5);
    expect(syncComplete.operations).toHaveLength(3);
    expect(syncComplete.operations![0].version).toBe(3);
    expect(syncComplete.operations![1].version).toBe(4);
    expect(syncComplete.operations![2].version).toBe(5);

    guestClient.ws.close();
    hostClient.ws.close();
  });

  // -------------------------------------------------------------------------
  // 6. Periodic snapshot: 100 ops sent, rate limiting allows most through
  // -------------------------------------------------------------------------
  it("handles 100 operations (rate limit allows most through, no crash)", async () => {
    const hostClient = await connectClient(TEST_ROOM + "-snap");
    hostClient.ws.send(
      JSON.stringify({
        type: "host:join",
        protocol: 2,
        roomId: TEST_ROOM + "-snap",
        diagramId: TEST_ROOM + "-snap",
        user: makeUser(0),
        snapshot: makeSnapshot(),
      }),
    );
    await waitForMessage(hostClient, "host:ack");

    let successCount = 0;
    // Space ops at 180ms each (beyond the rate limit window) so all go through.
    // The snapshot accumulator triggers at 100 ops, which is the point of this test.
    for (let v = 0; v < 100; v++) {
      hostClient.ws.send(
        JSON.stringify({
          type: "host:patch",
          roomId: TEST_ROOM + "-snap",
          patch: { nodeLayouts: { [`n${v}`]: { x: v } } },
          version: v,
        }),
      );
      // Don't await — collect what we can; some may be rate-limited and never return ACK.
      try {
        await waitForMessage(hostClient, "OP_ACK", 2000);
        successCount++;
      } catch {
        // Rate-limited ops never return OP_ACK — that's expected.
      }
      await new Promise<void>((r) => setTimeout(r, 180));
    }
    // All 100 ops succeed with 180ms spacing (outside 1s rate-limit window)
    expect(successCount).toBe(100);

    hostClient.ws.close();
  }, 30_000);

  // -------------------------------------------------------------------------
  // 7. Rate limit: ops inside the 1s window are capped at 50; 51st is rejected
  // -------------------------------------------------------------------------
  it("rejects ops beyond the 50-per-second rate limit", async () => {
    const hostClient = await connectClient(TEST_ROOM + "-rate");
    hostClient.ws.send(
      JSON.stringify({
        type: "host:join",
        protocol: 2,
        roomId: TEST_ROOM + "-rate",
        diagramId: TEST_ROOM + "-rate",
        user: makeUser(0),
        snapshot: makeSnapshot(),
      }),
    );
    await waitForMessage(hostClient, "host:ack");

    // Send 52 ops back-to-back (no artificial spacing). Node.js processes them
    // fast enough that 50 fit in the rate-limit window and 2 are rejected.
    for (let v = 0; v < 52; v++) {
      hostClient.ws.send(
        JSON.stringify({
          type: "host:patch",
          roomId: TEST_ROOM + "-rate",
          patch: { nodeLayouts: { [`n${v}`]: { x: v } } },
          version: v,
        }),
      );
    }

    // Wait for all 52 responses (50 OP_ACK + 2 error)
    let opAckCount = 0;
    let errorCount = 0;
    for (let i = 0; i < 52; i++) {
      const msg = await waitForMessage(hostClient, ["OP_ACK", "error"], 3000);
      if ((msg as { type: string }).type === "OP_ACK") opAckCount++;
      else errorCount++;
    }

    // First 50 ops succeed; the remaining 2 are rate-limited
    expect(opAckCount).toBe(50);
    expect(errorCount).toBe(2);

    hostClient.ws.close();
  });

  // -------------------------------------------------------------------------
  // B2 variant: version-gap patch is applied AND SYNC_REQUIRED warning sent
  // -------------------------------------------------------------------------
  it("sends SYNC_REQUIRED as warning after applying version-gap patch", async () => {
    const hostClient = await connectClient(TEST_ROOM + "-syncwarn");
    hostClient.ws.send(
      JSON.stringify({
        type: "host:join",
        protocol: 2,
        roomId: TEST_ROOM + "-syncwarn",
        diagramId: TEST_ROOM + "-syncwarn",
        user: makeUser(0),
        snapshot: makeSnapshot(),
      }),
    );
    await waitForMessage(hostClient, "host:ack");

    for (let v = 0; v < 2; v++) {
      hostClient.ws.send(
        JSON.stringify({
          type: "host:patch",
          roomId: TEST_ROOM + "-syncwarn",
          patch: { nodeLayouts: { [`n${v}`]: { x: v } } },
          version: v,
        }),
      );
      await waitForMessage(hostClient, "OP_ACK");
    }

    const guestClient = await connectClient(TEST_ROOM + "-syncwarn");
    guestClient.ws.send(
      JSON.stringify({ type: "guest:join",
        protocol: 2, roomId: TEST_ROOM + "-syncwarn", user: makeUser(1) }),
    );
    await waitForMessage(guestClient, "session:init");

    // Guest sends patch with version 0 (room is at version 2) — gap of 2
    guestClient.ws.send(
      JSON.stringify({
        type: "guest:patch",
        roomId: TEST_ROOM + "-syncwarn",
        patch: { nodeLayouts: { guestNode: { x: 999 } } },
        version: 0,
      }),
    );

    // Patch is applied (OP_ACK accepted)
    const ack = (await waitForMessage(guestClient, "OP_ACK")) as { accepted?: boolean };
    expect(ack.accepted).toBe(true);

    // SYNC_REQUIRED is sent as non-blocking warning
    const syncRequired = (await waitForMessage(guestClient, "SYNC_REQUIRED")) as {
      type: string;
      reason?: string;
    };
    expect(syncRequired.type).toBe("SYNC_REQUIRED");
    expect(syncRequired.reason).toBe("VERSION_GAP");

    guestClient.ws.close();
    hostClient.ws.close();
  });

  // -------------------------------------------------------------------------
  // 8. Payload cap: >100KB payload is rejected without crashing
  // -------------------------------------------------------------------------
  it("rejects payloads larger than 100KB", async () => {
    const hostClient = await connectClient(TEST_ROOM + "-big");
    hostClient.ws.send(
      JSON.stringify({
        type: "host:join",
        protocol: 2,
        roomId: TEST_ROOM + "-big",
        diagramId: TEST_ROOM + "-big",
        user: makeUser(0),
        snapshot: makeSnapshot(),
      }),
    );
    await waitForMessage(hostClient, "host:ack");

    hostClient.ws.send(
      JSON.stringify({
        type: "host:patch",
        roomId: TEST_ROOM + "-big",
        patch: { nodeLayouts: { data: "x".repeat(102_400) } },
        version: 0,
      }),
    );

    const error = (await waitForMessage(hostClient, "error")) as { code?: string };
    // Oversized payloads are rejected as invalid_json (size check runs before JSON parse)
    expect(error.code).toBe("invalid_json");

    hostClient.ws.close();
  });

  // -------------------------------------------------------------------------
  // 9. Cleanup: guest disconnect broadcasts peer:left with decremented count
  // -------------------------------------------------------------------------
  it("broadcasts peer:left with correct participantCount on guest disconnect", async () => {
    const hostClient = await connectClient(TEST_ROOM + "-cleanup");
    hostClient.ws.send(
      JSON.stringify({
        type: "host:join",
        protocol: 2,
        roomId: TEST_ROOM + "-cleanup",
        diagramId: TEST_ROOM + "-cleanup",
        user: makeUser(0),
        snapshot: makeSnapshot(),
      }),
    );
    await waitForMessage(hostClient, "host:ack");

    const guestClient = await connectClient(TEST_ROOM + "-cleanup");
    guestClient.ws.send(
      JSON.stringify({ type: "guest:join",
        protocol: 2, roomId: TEST_ROOM + "-cleanup", user: makeUser(1) }),
    );
    const init = (await waitForMessage(guestClient, "session:init")) as {
      participantCount?: number;
    };
    expect(init.participantCount).toBe(2);

    guestClient.ws.close();

    const peerLeft = (await waitForMessage(hostClient, "peer:left")) as {
      clientId?: string;
      participantCount?: number;
    };
    expect(peerLeft.participantCount).toBe(1);

    hostClient.ws.close();
  });
  // -------------------------------------------------------------------------
  // 11. Convergence: concurrent edits to DIFFERENT entities must both survive
  // -------------------------------------------------------------------------
  it("keeps concurrent edits to different nodes (no whole-collection clobber)", async () => {
    const room = TEST_ROOM + "-converge";
    const host = await connectClient(room);
    host.ws.send(
      JSON.stringify({
        type: "host:join",
        protocol: 2,
        roomId: room,
        diagramId: room,
        user: makeUser(0),
        snapshot: makeSnapshot({
          diagramId: room,
          nodeLayouts: {
            "node-a": { elementId: "node-a", x: 0, y: 0 },
            "node-b": { elementId: "node-b", x: 0, y: 0 },
          },
        }),
      }),
    );
    await waitForMessage(host, "host:ack");

    const guest = await connectClient(room);
    guest.ws.send(JSON.stringify({ type: "guest:join",
        protocol: 2, roomId: room, user: makeUser(1) }));
    await waitForMessage(guest, "session:init");

    // Host moves node-a; guest moves node-b. Different entities, so both edits
    // must survive regardless of arrival order.
    host.ws.send(
      JSON.stringify({
        type: "host:patch",
        roomId: room,
        patch: { nodeLayouts: { "node-a": { elementId: "node-a", x: 111, y: 111 } } },
      }),
    );
    await waitForMessage(host, "OP_ACK");

    guest.ws.send(
      JSON.stringify({
        type: "guest:patch",
        roomId: room,
        patch: { nodeLayouts: { "node-b": { elementId: "node-b", x: 222, y: 222 } } },
      }),
    );
    await waitForMessage(guest, "OP_ACK");

    // A fresh joiner receives the authoritative snapshot: the proof of what the
    // server actually kept.
    const observer = await connectClient(room);
    observer.ws.send(JSON.stringify({ type: "guest:join",
        protocol: 2, roomId: room, user: makeUser(2) }));
    const init = (await waitForMessage(observer, "session:init")) as Record<string, unknown>;
    const layouts = (init.snapshot as Record<string, unknown>).nodeLayouts as Record<
      string,
      { x: number; y: number }
    >;

    expect(layouts["node-a"]).toMatchObject({ x: 111, y: 111 });
    expect(layouts["node-b"]).toMatchObject({ x: 222, y: 222 });

    host.ws.close();
    guest.ws.close();
    observer.ws.close();
  });

  // -------------------------------------------------------------------------
  // 12. Tombstones: a null entity entry deletes it without touching siblings
  // -------------------------------------------------------------------------
  it("deletes an entity on a null tombstone and leaves siblings intact", async () => {
    const room = TEST_ROOM + "-tombstone";
    const host = await connectClient(room);
    host.ws.send(
      JSON.stringify({
        type: "host:join",
        protocol: 2,
        roomId: room,
        diagramId: room,
        user: makeUser(0),
        snapshot: makeSnapshot({
          diagramId: room,
          nodeLayouts: {
            "keep-me": { elementId: "keep-me", x: 5, y: 5 },
            "delete-me": { elementId: "delete-me", x: 9, y: 9 },
          },
        }),
      }),
    );
    await waitForMessage(host, "host:ack");

    host.ws.send(
      JSON.stringify({
        type: "host:patch",
        roomId: room,
        patch: { nodeLayouts: { "delete-me": null } },
      }),
    );
    await waitForMessage(host, "OP_ACK");

    const observer = await connectClient(room);
    observer.ws.send(JSON.stringify({ type: "guest:join",
        protocol: 2, roomId: room, user: makeUser(1) }));
    const init = (await waitForMessage(observer, "session:init")) as Record<string, unknown>;
    const layouts = (init.snapshot as Record<string, unknown>).nodeLayouts as Record<string, unknown>;

    expect(layouts["delete-me"]).toBeUndefined();
    expect(layouts["keep-me"]).toMatchObject({ x: 5, y: 5 });

    host.ws.close();
    observer.ws.close();
  });
  // -------------------------------------------------------------------------
  // 13. Protocol guard: a client that does not declare v2 is refused, not
  //     silently fed sparse patches it would misread as whole collections.
  // -------------------------------------------------------------------------
  it("refuses a join that declares no protocol version", async () => {
    const room = TEST_ROOM + "-proto";
    const legacy = await connectClient(room);

    // A v1 client: no protocol field at all.
    legacy.ws.send(
      JSON.stringify({
        type: "host:join",
        roomId: room,
        diagramId: room,
        user: makeUser(0),
        snapshot: makeSnapshot({ diagramId: room }),
      }),
    );

    const err = (await waitForMessage(legacy, "error", 5000)) as Record<string, unknown>;
    expect(err.code).toBe("protocol_mismatch");

    legacy.ws.close();
  });
});
