import { describe, expect, it } from "vitest";
import { WebviewPlacer } from "./webview-placer";

const graph = {
  components: [{ key: "a", name: "a", type: "container", description: "", x: 0, y: 0 }],
  connections: [],
};
const input = { graph };

type Posted = { type: string; id: number };

const engineWith = (timeoutMs?: number) => {
  const posted: Posted[] = [];
  const engine = new WebviewPlacer(
    (m) => posted.push(m as Posted),
    () => ({ mode: "manual", settings: { density: "compact" } }),
    timeoutMs,
  );
  return { engine, posted };
};

describe("WebviewPlacer", () => {
  it("waits for the webview, then posts STRUCTURA_PLACE with the arrange settings and resolves with its answer", async () => {
    const { engine, posted } = engineWith();
    const result = engine.place(input);
    expect(posted).toEqual([]);
    engine.ready();
    expect(posted).toMatchObject([
      { type: "STRUCTURA_PLACE", graph, arrange: { settings: { density: "compact" } } },
    ]);
    engine.receive({
      type: "STRUCTURA_PLACE_RESULT",
      id: posted[0]!.id,
      boxes: { a: { x: 40, y: 40, width: 180, height: 80 }, bad: { x: "no" } },
    });
    await expect(result).resolves.toEqual({
      boxes: { a: { x: 40, y: 40, width: 180, height: 80 } },
    });
  });

  it("posts what is unanswered again when the webview reloads", () => {
    const { engine, posted } = engineWith();
    engine.ready();
    void engine.place(input);
    engine.unready();
    engine.ready();
    expect(posted.map((m) => m.id)).toEqual([1, 1]);
  });

  it("rejects on the webview's error, at the timeout, and when the preview closes", async () => {
    const { engine, posted } = engineWith(20);
    engine.ready();
    const failed = engine.place(input);
    engine.receive({ type: "STRUCTURA_PLACE_RESULT", id: posted[0]!.id, error: "boom" });
    await expect(failed).rejects.toThrow(/boom/);

    await expect(engine.place(input)).rejects.toThrow(/did not answer/);

    const closing = engine.place(input);
    engine.dispose();
    await expect(closing).rejects.toThrow(/closed/);
    await expect(engine.place(input)).rejects.toThrow(/closed/);
  });

  it("ignores answers to nothing it asked", async () => {
    const { engine } = engineWith();
    engine.ready();
    const pending = engine.place(input);
    engine.receive({ type: "STRUCTURA_PLACE_RESULT", id: 99, boxes: {} });
    engine.receive(null);
    engine.receive({ type: "STRUCTURA_PLACE_RESULT", id: 1, boxes: {} });
    await expect(pending).resolves.toEqual({ boxes: {} });
  });
});
