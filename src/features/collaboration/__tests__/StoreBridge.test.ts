import { afterEach, describe, expect, it, vi } from "vitest";
import type { DiagramPatch, Entry } from "@collab-protocol";
import { createTestDiagramStore } from "@/features/diagram/store/test-utils";
import { StoreBridge } from "../sync/StoreBridge";

afterEach(() => {
  vi.useRealTimers();
});

function setup(inboundBatchMs = 32) {
  vi.useFakeTimers();
  const store = createTestDiagramStore();
  const diagram = store.getState().addDiagram("Load", "context");
  store.getState().openDiagram(diagram.id);
  const ids = [0, 1, 2].map(
    (i) => store.getState().addComponent("system", `C${i}`, null, { x: i * 100, y: 0 }).id,
  );
  const sent: Array<{ patch: DiagramPatch; baseVersion: number }> = [];
  let op = 0;
  const bridge = new StoreBridge({
    store,
    diagramId: diagram.id,
    selfId: "me",
    sendIntervalMs: 0,
    inboundBatchMs,
    transport: {
      sendPatch: (patch, baseVersion) => {
        sent.push({ patch, baseVersion });
        return `me|${++op}`;
      },
    },
  });
  bridge.onSeeded(bridge.currentState()!);
  bridge.attach();
  const layout = (id: string) => store.getState().diagrams[diagram.id]!.nodeLayouts[id]!;
  let version = 0;
  const peerMove = (id: string, x: number): Entry => ({
    version: ++version,
    opId: `peer|${version}`,
    sender: "peer",
    patch: { entities: { nodeLayouts: { [id]: { set: { x } } } } },
  });
  return { store, bridge, ids, sent, layout, peerMove };
}

describe("StoreBridge inbound batching", () => {
  it("applies a burst of peer entries with one store update", () => {
    const { store, bridge, ids, layout, peerMove } = setup();
    const updates = vi.fn();
    store.subscribe(updates);

    for (let i = 0; i < 50; i++) bridge.onEntry(peerMove(ids[i % 3]!, 1000 + i));
    expect(updates).not.toHaveBeenCalled();

    vi.advanceTimersByTime(32);
    expect(updates).toHaveBeenCalledTimes(1);
    expect(layout(ids[0]!).x).toBe(1048);
    expect(layout(ids[1]!).x).toBe(1049);
    expect(bridge.version).toBe(50);
  });

  it("keeps a local edit made while peer entries wait, and sends only that edit", () => {
    const { store, bridge, ids, sent, layout, peerMove } = setup();
    bridge.onEntry(peerMove(ids[0]!, 777));
    // The user moves another node before the batch lands.
    store.getState().updateNodeLayout(ids[1]!, { x: 5, y: 5 });
    vi.advanceTimersByTime(32);

    expect(layout(ids[0]!).x).toBe(777);
    expect(layout(ids[1]!)).toMatchObject({ x: 5, y: 5 });
    // Nothing that undoes the peer's move ever goes out.
    const touched = sent.flatMap((s) => Object.keys(s.patch.entities?.nodeLayouts ?? {}));
    expect(touched).not.toContain(ids[0]);
    expect(touched).toContain(ids[1]);
  });

  it("drains before sending, so a local patch is based on every entry received", () => {
    const { store, bridge, ids, sent, peerMove } = setup(10_000);
    bridge.onEntry(peerMove(ids[0]!, 1));
    bridge.onEntry(peerMove(ids[0]!, 2));
    store.getState().updateNodeLayout(ids[2]!, { x: 9, y: 9 });
    bridge.flush();
    expect(sent[sent.length - 1]?.baseVersion).toBe(2);
  });

  it("a hidden tab applies at once instead of waiting for a timer", () => {
    const { bridge, ids, layout, peerMove } = setup();
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    bridge.onEntry(peerMove(ids[0]!, 4242));
    expect(layout(ids[0]!).x).toBe(4242);
    hidden.mockRestore();
  });
});
