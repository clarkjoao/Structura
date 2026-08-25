import { describe, expect, it } from "vitest";
import type { Component, Diagram } from "@/features/diagram";
import { applyServiceRelink } from "./apply-service-relink";

function component(id: string, serviceId?: string): Component {
  return {
    id,
    name: id,
    description: "",
    parentId: null,
    type: "container",
    ...(serviceId ? { serviceId } : {}),
  } as Component;
}

function diagram(components: Component[], sceneComponents: Component[] = []): Diagram {
  return {
    id: "d1",
    name: "d1",
    level: "container",
    createdAt: 1,
    updatedAt: 1,
    snapshot: {
      components: Object.fromEntries(components.map((c) => [c.id, c])),
      connections: {},
      flows: {},
      iconLibrary: {},
    },
    nodeLayouts: {},
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
    ...(sceneComponents.length > 0
      ? {
          scenes: {
            s1: {
              id: "s1",
              name: "s1",
              addedComponents: Object.fromEntries(sceneComponents.map((c) => [c.id, c])),
            } as never,
          },
        }
      : {}),
  } as Diagram;
}

describe("applyServiceRelink", () => {
  it("remaps the serviceId of every component pointing at the old id", () => {
    const result = applyServiceRelink(
      diagram([component("c1", "svc-remote"), component("c2", "svc-remote")]),
      { remap: { "svc-remote": "svc-local" }, clear: [] },
    );

    expect(result.snapshot.components.c1.serviceId).toBe("svc-local");
    expect(result.snapshot.components.c2.serviceId).toBe("svc-local");
  });

  it("remaps scene components too", () => {
    const result = applyServiceRelink(
      diagram([component("c1", "svc-remote")], [component("s-c1", "svc-remote")]),
      { remap: { "svc-remote": "svc-local" }, clear: [] },
    );

    expect(result.scenes?.s1.addedComponents["s-c1"].serviceId).toBe("svc-local");
  });

  it("clears a dangling serviceId the user chose to drop", () => {
    const result = applyServiceRelink(diagram([component("c1", "svc-gone")]), {
      remap: {},
      clear: ["svc-gone"],
    });

    expect(result.snapshot.components.c1.serviceId).toBeUndefined();
  });

  it("leaves components pointing at untouched services alone", () => {
    const result = applyServiceRelink(
      diagram([component("c1", "svc-remote"), component("c2", "svc-keep")]),
      { remap: { "svc-remote": "svc-local" }, clear: [] },
    );

    expect(result.snapshot.components.c2.serviceId).toBe("svc-keep");
  });

  it("leaves unlinked components alone", () => {
    const result = applyServiceRelink(diagram([component("c1")]), {
      remap: { "svc-remote": "svc-local" },
      clear: [],
    });

    expect(result.snapshot.components.c1.serviceId).toBeUndefined();
  });

  it("returns the same diagram when there is nothing to decide", () => {
    const input = diagram([component("c1", "svc-remote")]);

    expect(applyServiceRelink(input, { remap: {}, clear: [] })).toBe(input);
  });

  it("returns the same diagram when no component matches the decisions", () => {
    const input = diagram([component("c1", "svc-other")]);

    expect(applyServiceRelink(input, { remap: { "svc-remote": "svc-local" }, clear: [] })).toBe(
      input,
    );
  });
});
