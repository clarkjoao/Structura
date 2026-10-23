import { afterEach, describe, expect, it } from "vitest";
import type { Component } from "@/features/diagram";
import { useDiagramStore } from "@/features/diagram";
import { useCollabStore } from "@/features/collaboration/store/collab.store";
import { autoLayoutActiveDiagram } from "./autoLayoutDiagram";
import {
  arrangeableElementCount,
  isArrangeBlockedInSession,
  SESSION_ARRANGE_MAX_ELEMENTS,
} from "./sessionArrangeGuard";

const component = (id: string, type: Component["type"] = "container"): Component =>
  ({ id, name: id, description: "", parentId: null, type }) as Component;

function elements(count: number, extra: Component[] = []): Record<string, Component> {
  const list = Array.from({ length: count }, (_, i) => component(`c${i}`));
  return Object.fromEntries([...list, ...extra].map((c) => [c.id, c]));
}

describe("isArrangeBlockedInSession", () => {
  it("blocks only a live session with more elements than the limit", () => {
    const large = elements(SESSION_ARRANGE_MAX_ELEMENTS + 1);
    const atLimit = elements(SESSION_ARRANGE_MAX_ELEMENTS);
    expect(isArrangeBlockedInSession(large, true)).toBe(true);
    expect(isArrangeBlockedInSession(atLimit, true)).toBe(false);
    expect(isArrangeBlockedInSession(large, false)).toBe(false);
  });

  it("does not count free text, which an arrangement leaves alone", () => {
    const withTexts = elements(SESSION_ARRANGE_MAX_ELEMENTS, [
      component("t1", "text"),
      component("t2", "text"),
    ]);
    expect(arrangeableElementCount(withTexts)).toBe(SESSION_ARRANGE_MAX_ELEMENTS);
    expect(isArrangeBlockedInSession(withTexts, true)).toBe(false);
  });
});

describe("autoLayoutActiveDiagram in a live session", () => {
  afterEach(() => {
    useCollabStore.getState().reset();
  });

  it("leaves a large diagram alone, as the button does", async () => {
    const store = useDiagramStore.getState();
    const diagram = store.addDiagram("Large session", "container");
    store.openDiagram(diagram.id);
    for (let i = 0; i <= SESSION_ARRANGE_MAX_ELEMENTS; i += 1) {
      useDiagramStore.getState().addComponent("system", `S${i}`, null, { x: i, y: 0 });
    }
    const before = structuredClone(useDiagramStore.getState().diagrams[diagram.id]!.nodeLayouts);
    useCollabStore.getState().setSession({
      roomId: "r",
      isHost: true,
      localUser: { id: "u", name: "U", color: "#000" },
      peers: [],
      status: "connected",
    });

    expect(await autoLayoutActiveDiagram()).toBeNull();
    expect(useDiagramStore.getState().diagrams[diagram.id]!.nodeLayouts).toEqual(before);
  });
});
