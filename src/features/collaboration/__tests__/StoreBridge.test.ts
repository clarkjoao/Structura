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

describe("StoreBridge remote-write marker", () => {
  it("marks a peer's change, and not a local edit", () => {
    const { store, ids, bridge, peerMove } = setup();
    const before = store.getState()._lastRemoteWriteAt;

    store.getState().updateNodeLayout(ids[0]!, { x: 9, y: 9 });
    vi.advanceTimersByTime(32);
    expect(store.getState()._lastRemoteWriteAt).toBe(before);

    bridge.onEntry(peerMove(ids[1]!, 500));
    vi.advanceTimersByTime(32);
    expect(store.getState()._lastRemoteWriteAt).toBe(before + 1);
  });
});

describe("StoreBridge reading direction and arrange settings (ADR-0013 step 4)", () => {
  const FULL = new Set([
    "diagramId",
    "diagramName",
    "level",
    "domain",
    "description",
    "activeVersionId",
    "compareVersionId",
    "direction",
    "layoutSettings",
  ]);

  function vertical(store: ReturnType<typeof setup>["store"], ids: string[]) {
    store.getState().applyAutoLayout([{ elementId: ids[0]!, x: 0, y: 0 }], undefined, {
      direction: "TB",
      layoutSettings: { mode: "automatic" },
    });
  }

  it("sends nothing new to a relay that did not declare the fields", () => {
    const { store, ids, sent } = setup();
    vertical(store, ids);
    vi.advanceTimersByTime(200);
    for (const { patch } of sent) {
      expect(patch.doc && "direction" in patch.doc).toBeFalsy();
      expect(patch.doc && "layoutSettings" in patch.doc).toBeFalsy();
    }
  });

  it("sends them once the relay declares them", () => {
    const { store, ids, sent, bridge } = setup();
    vertical(store, ids);
    vi.advanceTimersByTime(200);
    bridge.setDocFields(FULL);
    vi.advanceTimersByTime(200);
    const docs = sent.map((s) => s.patch.doc).filter(Boolean);
    expect(docs).toContainEqual(
      expect.objectContaining({ direction: "TB", layoutSettings: { mode: "automatic" } }),
    );
  });

  it("applies a peer's direction and keeps it through the local user's undo", () => {
    const { store, bridge, ids } = setup();
    bridge.setDocFields(FULL);
    const diagramId = store.getState().activeDiagramId!;
    // A local edit, then the peer switches the axis.
    store.getState().updateNodeLayout(ids[0]!, { x: 5, y: 5 });
    vi.advanceTimersByTime(200);
    bridge.onEntry({
      version: (bridge.version ?? 0) + 1,
      opId: "peer|1",
      sender: "peer",
      patch: { doc: { direction: "TB", layoutSettings: { density: "spacious" } } },
    });
    vi.advanceTimersByTime(64);
    expect(store.getState().diagrams[diagramId]!.direction).toBe("TB");
    expect(store.getState().diagrams[diagramId]!.layoutSettings).toEqual({ density: "spacious" });

    store.getState().undo();
    expect(store.getState().diagrams[diagramId]!.direction).toBe("TB");
  });

  it("clears the direction a peer set back to left-to-right, and ignores junk", () => {
    const { store, bridge } = setup();
    bridge.setDocFields(FULL);
    const diagramId = store.getState().activeDiagramId!;
    const entry = (version: number, doc: Record<string, unknown>) => ({
      version,
      opId: `peer|${version}`,
      sender: "peer",
      patch: { doc },
    });
    bridge.onEntry(entry((bridge.version ?? 0) + 1, { direction: "TB" }));
    vi.advanceTimersByTime(64);
    bridge.onEntry(entry((bridge.version ?? 0) + 1, { direction: null }));
    vi.advanceTimersByTime(64);
    expect("direction" in store.getState().diagrams[diagramId]!).toBe(false);

    bridge.onEntry(entry((bridge.version ?? 0) + 1, { direction: "diagonal", layoutSettings: 7 }));
    vi.advanceTimersByTime(64);
    expect("direction" in store.getState().diagrams[diagramId]!).toBe(false);
    expect("layoutSettings" in store.getState().diagrams[diagramId]!).toBe(false);
  });
});
