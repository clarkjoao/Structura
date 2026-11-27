import { describe, expect, it, vi } from "vitest";
import * as place from "@/features/plugins/plugin-place";
import { answerPlaceRequest } from "./place-request";
import { PLACE, PLACE_RESULT, readEmbedMessage } from "./protocol";

const graph = {
  components: [
    { key: "a", name: "a", type: "container", x: 0, y: 0 },
    { key: "b", name: "b", type: "container", x: 0, y: 0 },
  ],
  connections: [{ source: "a", target: "b", label: "calls" }],
};

describe("STRUCTURA_PLACE", () => {
  it("is read with its id, graph, previous and arrange; malformed requests are ignored", () => {
    const previous = { a: { x: 1, y: 2, width: 3, height: 4, parentKey: null } };
    expect(
      readEmbedMessage({
        type: PLACE,
        id: 7,
        graph,
        previous,
        arrange: { mode: "manual", settings: { density: "compact" } },
      }),
    ).toEqual({
      type: PLACE,
      id: 7,
      graph,
      previous,
      arrange: { mode: "manual", settings: { density: "compact" } },
    });
    expect(readEmbedMessage({ type: PLACE, graph })).toBeNull();
    expect(readEmbedMessage({ type: PLACE, id: 1, graph: { components: [] } })).toBeNull();
  });

  it("answers with exactly what api.layout.place returns a plugin, under the arrange settings", async () => {
    const message = readEmbedMessage({
      type: PLACE,
      id: 7,
      graph,
      arrange: { mode: "manual", settings: { density: "spacious" } },
    });
    if (message?.type !== PLACE) throw new Error("not read");
    const answer = await answerPlaceRequest(message);
    const boxes = await place.placeGraph({ graph, settings: { density: "spacious" } });
    expect(answer).toEqual({ type: PLACE_RESULT, id: 7, boxes });
    expect(Object.keys(boxes).sort()).toEqual(["a", "b"]);
  });

  it("answers a failure instead of leaving the host waiting", async () => {
    const spy = vi.spyOn(place, "placeGraph").mockRejectedValueOnce(new Error("boom"));
    const answer = await answerPlaceRequest({ type: PLACE, id: 3, graph });
    spy.mockRestore();
    expect(answer).toEqual({ type: PLACE_RESULT, id: 3, error: "boom" });
  });
});
