import { describe, expect, it } from "vitest";
import {
  applyEffectivePatch,
  chunkString,
  isDiagramPatch,
  isDiagramState,
  isEmptyPatch,
  parseClientMessage,
} from "./protocol.js";
import { makeState } from "./store/__fixtures__/merge.fixtures.js";

const user = { id: "u1", name: "Ana", color: "#123456" };

describe("parseClientMessage", () => {
  it("accepts every well-formed message type", () => {
    const valid: unknown[] = [
      { type: "create", protocol: 3, roomId: "r1", user, seedChars: 10, seedChunks: 1 },
      {
        type: "create",
        protocol: 3,
        roomId: "r1",
        user,
        seedChars: 10,
        seedChunks: 1,
        hostToken: "t",
      },
      { type: "seed:chunk", index: 0, data: "{}" },
      { type: "seed:commit" },
      { type: "join", protocol: 3, roomId: "r1", user },
      { type: "join", protocol: 3, roomId: "r1", user, hostToken: "t", resumeFrom: 4 },
      { type: "patch", opId: "o1", baseVersion: 0, patch: { doc: { diagramName: "x" } } },
      { type: "lock", action: "acquire", entityId: "n1" },
      { type: "cursor", cursor: { x: 1, y: 2 }, activeElementId: null },
      { type: "cursor", cursor: null, activeElementId: "n1" },
      { type: "close" },
      { type: "ping" },
      { type: "pong" },
    ];
    for (const message of valid) {
      expect(parseClientMessage(JSON.stringify(message)), JSON.stringify(message)).not.toBeNull();
    }
  });

  it("rejects malformed frames", () => {
    const invalid: string[] = [
      "not json",
      "[]",
      JSON.stringify({ type: "unknown" }),
      JSON.stringify({ type: "join", protocol: 3, roomId: "r1" }),
      JSON.stringify({ type: "join", protocol: 3, roomId: "r1", user: { id: "u" } }),
      JSON.stringify({ type: "join", protocol: 3, roomId: "r1", user, resumeFrom: -1 }),
      JSON.stringify({ type: "join", protocol: 3, roomId: "__proto__", user }),
      JSON.stringify({ type: "join", protocol: 3, roomId: "a}b", user }),
      JSON.stringify({ type: "patch", opId: "", baseVersion: 0, patch: {} }),
      JSON.stringify({ type: "patch", opId: "o", baseVersion: 1.5, patch: {} }),
      JSON.stringify({ type: "patch", opId: "o", baseVersion: 0, patch: { nodes: {} } }),
      JSON.stringify({ type: "lock", action: "steal", entityId: "n1" }),
      JSON.stringify({ type: "cursor", activeElementId: null }),
      JSON.stringify({ type: "cursor", cursor: { x: "1", y: 2 }, activeElementId: null }),
      JSON.stringify({ type: "seed:chunk", index: "0", data: "" }),
    ];
    for (const raw of invalid) expect(parseClientMessage(raw), raw).toBeNull();
  });

  it("rejects prototype-polluting keys anywhere in a patch", () => {
    const polluting = [
      '{"type":"patch","opId":"o","baseVersion":0,"patch":{"entities":{"components":{"__proto__":{"set":{}}}}}}',
      '{"type":"patch","opId":"o","baseVersion":0,"patch":{"entities":{"components":{"c1":{"set":{"constructor":1}}}}}}',
      '{"type":"patch","opId":"o","baseVersion":0,"patch":{"entities":{"components":{"c1":{"set":{"meta":{"__proto__":{"x":1}}}}}}}}',
      '{"type":"patch","opId":"o","baseVersion":0,"patch":{"entities":{"components":{"c1":{"unset":["prototype"]}}}}}',
    ];
    for (const raw of polluting) expect(parseClientMessage(raw), raw).toBeNull();
  });
});

describe("isDiagramPatch", () => {
  it("accepts doc and entity changes, removals and field removals", () => {
    expect(
      isDiagramPatch({
        doc: { diagramName: "x", activeVersionId: null },
        entities: { components: { c1: { set: { name: "A" } }, c2: null, c3: { unset: ["x"] } } },
      }),
    ).toBe(true);
  });

  it("rejects unknown collections, doc fields and entity patch keys", () => {
    expect(isDiagramPatch({ entities: { nodes: {} } })).toBe(false);
    expect(isDiagramPatch({ doc: { viewport: {} } })).toBe(false);
    expect(isDiagramPatch({ entities: { components: { c1: { merge: {} } } } })).toBe(false);
    expect(isDiagramPatch({ entities: { components: { c1: { unset: [1] } } } })).toBe(false);
  });
});

describe("isDiagramState", () => {
  it("requires every collection", () => {
    expect(isDiagramState(makeState())).toBe(true);
    const missing = makeState() as { entities: Record<string, unknown> };
    delete missing.entities.versions;
    expect(isDiagramState(missing)).toBe(false);
  });
});

describe("applyEffectivePatch", () => {
  it("applies sets, unsets and removals without touching unrelated identities", () => {
    const state = makeState({
      components: { c1: { id: "c1", name: "A", description: "d" }, c2: { id: "c2" } },
      nodeLayouts: { c1: { x: 1 } },
    });
    const next = applyEffectivePatch(state, {
      entities: { components: { c1: { set: { name: "B" }, unset: ["description"] }, c2: null } },
    });
    expect(next.entities.components).toEqual({ c1: { id: "c1", name: "B" } });
    expect(next.entities.nodeLayouts).toBe(state.entities.nodeLayouts);
    expect(state.entities.components.c1.name).toBe("A");
  });

  it("returns the same state for an empty patch", () => {
    const state = makeState();
    expect(applyEffectivePatch(state, {})).toBe(state);
    expect(isEmptyPatch({ entities: { components: {} } })).toBe(true);
  });
});

describe("chunkString", () => {
  it("round-trips and always yields at least one chunk", () => {
    expect(chunkString("")).toEqual([""]);
    const text = "x".repeat(130);
    const chunks = chunkString(text, 64);
    expect(chunks.map((c) => c.length)).toEqual([64, 64, 2]);
    expect(chunks.join("")).toBe(text);
  });
});
