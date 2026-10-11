import { afterEach, describe, expect, it } from "vitest";
import { randomColor } from "../utils/collab-colors";
import { newCollabRoomId, testServer } from "../utils/collab.utils";
import type { SocketLike } from "../sync/CollabClient";
import { LegacyRelaySocket, createRig, type Rig } from "./collabTestRig";

const PALETTE = [
  "#6366f1",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#06b6d4",
  "#8b5cf6",
  "#f97316",
  "#ec4899",
];

describe("collab-colors", () => {
  it("returns only colors from the fixed palette", () => {
    for (let index = 0; index < 40; index += 1) {
      expect(PALETTE).toContain(randomColor());
    }
  });

  it("palette has enough distinct colors for several simultaneous users", () => {
    expect(new Set(PALETTE).size).toBe(PALETTE.length);
    expect(PALETTE.length).toBeGreaterThanOrEqual(4);
  });
});

describe("collab.utils", () => {
  it("newCollabRoomId returns a non-empty id", () => {
    const roomId = newCollabRoomId();
    expect(roomId.length).toBeGreaterThan(0);
  });
});

describe("testServer", () => {
  let rig: Rig | null = null;
  afterEach(async () => {
    await rig?.stop();
    rig = null;
  });

  it("accepts a relay of this protocol", async () => {
    rig = await createRig();
    expect(await testServer("ws://test/ws", { createSocket: rig.createSocket })).toBe("ok");
  });

  it("flags a relay that accepts the socket but speaks another protocol", async () => {
    const result = await testServer("ws://test/ws", {
      createSocket: (url) => new LegacyRelaySocket(url),
    });
    expect(result).toBe("incompatible");
  });

  it("reports a socket that never opens as offline", async () => {
    const silent: SocketLike = {
      readyState: 0,
      send: () => {},
      close: () => {},
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
    };
    expect(await testServer("ws://test/ws", { timeoutMs: 20, createSocket: () => silent })).toBe(
      "offline",
    );
  });

  it("reports a refused connection as offline", async () => {
    rig = await createRig();
    rig.online = false;
    expect(await testServer("ws://test/ws", { createSocket: rig.createSocket })).toBe("offline");
  });
});
