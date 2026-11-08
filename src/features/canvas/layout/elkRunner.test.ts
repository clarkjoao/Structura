import { afterEach, describe, expect, it, vi } from "vitest";
import type { ElkNode } from "elkjs";

/**
 * `elk-api` waits for its worker with no timeout. A worker that dies must not
 * leave the layout pending: what is in flight is laid out on the main thread
 * instead, and so is everything after it.
 */

const graph: ElkNode = {
  id: "root",
  layoutOptions: { "elk.algorithm": "layered" },
  children: [
    { id: "a", width: 100, height: 50 },
    { id: "b", width: 100, height: 50 },
  ],
  edges: [{ id: "e", sources: ["a"], targets: ["b"] }],
};

/** A worker that fails as soon as it is created, as one whose script cannot load. */
class DyingWorker extends EventTarget {
  static created = 0;

  constructor() {
    super();
    DyingWorker.created += 1;
    setTimeout(() => {
      const event = new Event("error");
      Object.assign(event, { message: "failed to load" });
      this.dispatchEvent(event);
    }, 0);
  }

  postMessage(): void {}

  terminate(): void {}

  set onmessage(_handler: unknown) {}
}

async function freshRunner() {
  vi.resetModules();
  return import("./elkRunner");
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  DyingWorker.created = 0;
});

describe("runElk", () => {
  it("lays out on the main thread where there is no Worker", async () => {
    vi.stubGlobal("Worker", undefined);
    const { runElk } = await freshRunner();
    const result = await runElk(graph);
    expect(result.children?.map((c) => c.id).sort()).toEqual(["a", "b"]);
  });

  it("falls back to the main thread when the worker dies, and stays there", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("Worker", DyingWorker);
    const { runElk } = await freshRunner();
    const first = await runElk(graph);
    expect(first.children?.every((c) => c.x !== undefined)).toBe(true);
    const second = await runElk(graph);
    expect(second.children?.length).toBe(2);
    expect(DyingWorker.created).toBe(1);
  });
});
