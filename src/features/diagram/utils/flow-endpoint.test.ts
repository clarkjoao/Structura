import { describe, expect, it } from "vitest";
import type { Component } from "../model/component.types";
import type { Connection } from "../model/connection.types";
import type { Flow, FlowStep } from "../model/flow.types";
import {
  endpointCallers,
  endpointLabel,
  findEndpointMismatch,
  resolveStepEndpoint,
} from "./flow-endpoint";
import { getFlowParticipants } from "./flow-traversal";

/**
 * The route a step calls, read in both directions from the one field that
 * stores it.
 *
 * The endpoint never learns who calls it. That is the point: the reverse
 * direction is a walk, so deleting a step cannot leave a stale reference behind
 * the way `EndpointHandler.flowId` can when its flow is deleted.
 */

function component(partial: Partial<Component> & { id: string }): Component {
  return {
    name: partial.id,
    type: "container",
    description: "",
    parentId: null,
    ...partial,
  } as Component;
}

const COMPONENTS: Record<string, Component> = {
  api: component({ id: "api", name: "Management API", type: "container" }),
  group: component({
    id: "group",
    name: "Management API",
    type: "api-group",
    parentId: "api",
    serviceName: "management-api",
    basePath: "/api/v1",
    protocol: "REST",
  }),
  post: component({
    id: "post",
    name: "Criar URL",
    type: "endpoint",
    parentId: "group",
    method: "POST",
    path: "/urls",
    handlers: [],
  }),
  other: component({ id: "other", name: "Redirect API", type: "container" }),
};

const CONNECTIONS: Record<string, Connection> = {
  "spa-api": {
    id: "spa-api",
    sourceId: "spa",
    targetId: "api",
    label: "REST API calls",
  } as Connection,
  "spa-other": { id: "spa-other", sourceId: "spa", targetId: "other", label: "GET" } as Connection,
};

const step = (partial: Partial<FlowStep>): FlowStep =>
  ({ id: "s1", type: "action", ...partial }) as FlowStep;

describe("the route a step names", () => {
  it("resolves to the endpoint and the group it hangs off", () => {
    const state = resolveStepEndpoint(step({ endpointId: "post" }), COMPONENTS);

    expect(state.kind).toBe("present");
    if (state.kind !== "present") return;
    expect(state.label).toBe("POST /urls");
    expect(state.group?.id).toBe("group");
  });

  it("says nothing when the step names none", () => {
    expect(resolveStepEndpoint(step({}), COMPONENTS)).toEqual({ kind: "none" });
    expect(resolveStepEndpoint(null, COMPONENTS)).toEqual({ kind: "none" });
  });

  it("says the route is gone rather than falling back", () => {
    expect(resolveStepEndpoint(step({ endpointId: "deleted" }), COMPONENTS)).toEqual({
      kind: "gone",
      endpointId: "deleted",
    });
  });

  it("treats an id naming something that is not a route as gone", () => {
    // Whatever it points at, the route it claimed is not there.
    expect(resolveStepEndpoint(step({ endpointId: "api" }), COMPONENTS)).toEqual({
      kind: "gone",
      endpointId: "api",
    });
  });

  it("resolves a route whose group has been deleted", () => {
    const orphan = { ...COMPONENTS, post: { ...COMPONENTS.post!, parentId: "vanished" } };
    const state = resolveStepEndpoint(step({ endpointId: "post" }), orphan);

    expect(state.kind).toBe("present");
    if (state.kind !== "present") return;
    expect(state.group).toBeNull();
    expect(state.label).toBe("POST /urls");
  });

  it("names a route by method and path", () => {
    expect(endpointLabel(COMPONENTS.post as never)).toBe("POST /urls");
  });
});

function flow(id: string, name: string, steps: Record<string, Partial<FlowStep>>): Flow {
  const built: Record<string, FlowStep> = {};
  for (const [stepId, partial] of Object.entries(steps)) {
    built[stepId] = { id: stepId, type: "action", ...partial } as FlowStep;
  }
  return { id, name, mermaid: "", diagramId: "d1", entryStepId: "a", steps: built };
}

describe("the scripts that exercise a route", () => {
  const CREATE = flow("f1", "Criar link", {
    a: { endpointId: "post", next: "b" },
    b: { componentId: "api" },
  });
  const RETRY = flow("f2", "Repetir", { a: { endpointId: "post" } });

  it("names every flow and step that calls it", () => {
    expect(endpointCallers([CREATE, RETRY], "post")).toEqual([
      { flowId: "f1", flowName: "Criar link", stepId: "a" },
      { flowId: "f2", flowName: "Repetir", stepId: "a" },
    ]);
  });

  it("says nothing about a route nothing calls", () => {
    expect(endpointCallers([CREATE, RETRY], "get")).toEqual([]);
  });

  it("forgets a deleted step with nothing to clean up", () => {
    const without = flow("f1", "Criar link", { a: { componentId: "api" } });

    expect(endpointCallers([without, RETRY], "post")).toEqual([
      { flowId: "f2", flowName: "Repetir", stepId: "a" },
    ]);
  });

  it("counts the route among the elements the script touches", () => {
    expect([...getFlowParticipants(CREATE).componentIds].sort()).toEqual(["api", "post"]);
  });

  it("leaves participants alone for a script naming no route", () => {
    const plain = flow("f3", "Simples", { a: { componentId: "api", connectionId: "spa-api" } });
    const { componentIds, connectionIds } = getFlowParticipants(plain);

    expect([...componentIds]).toEqual(["api"]);
    expect([...connectionIds]).toEqual(["spa-api"]);
  });
});

describe("whether the call arrives where the route lives", () => {
  it("says nothing when it does, through the group", () => {
    const s = step({ endpointId: "post", connectionId: "spa-api" });

    expect(findEndpointMismatch(s, COMPONENTS, CONNECTIONS)).toBeNull();
  });

  it("says nothing on the way back either, the edge being the same call", () => {
    const s = step({ endpointId: "post", connectionId: "spa-api", payloadDirection: "response" });

    expect(findEndpointMismatch(s, COMPONENTS, CONNECTIONS)).toBeNull();
  });

  it("reports a route that belongs somewhere else", () => {
    const s = step({ endpointId: "post", connectionId: "spa-other" });

    expect(findEndpointMismatch(s, COMPONENTS, CONNECTIONS)).toEqual({
      arrivesAtId: "other",
      belongsToId: "group",
    });
  });

  it("has nothing to disagree with when the step names no call", () => {
    expect(findEndpointMismatch(step({ endpointId: "post" }), COMPONENTS, CONNECTIONS)).toBeNull();
  });

  it("has nothing to disagree with when the step names no route", () => {
    expect(
      findEndpointMismatch(step({ connectionId: "spa-api" }), COMPONENTS, CONNECTIONS),
    ).toBeNull();
  });

  it("stays quiet when either end is gone, having nothing to compare", () => {
    const gone = step({ endpointId: "deleted", connectionId: "spa-api" });
    const noEdge = step({ endpointId: "post", connectionId: "deleted" });

    expect(findEndpointMismatch(gone, COMPONENTS, CONNECTIONS)).toBeNull();
    expect(findEndpointMismatch(noEdge, COMPONENTS, CONNECTIONS)).toBeNull();
  });

  it("accepts a call drawn straight at the route", () => {
    const direct: Record<string, Connection> = {
      d: { id: "d", sourceId: "spa", targetId: "post", label: "" } as Connection,
    };
    const s = step({ endpointId: "post", connectionId: "d" });

    expect(findEndpointMismatch(s, COMPONENTS, direct)).toBeNull();
  });

  it("terminates on a parent chain that loops", () => {
    const cyclic = {
      ...COMPONENTS,
      group: { ...COMPONENTS.group!, parentId: "post" },
      post: { ...COMPONENTS.post!, parentId: "group" },
    };
    const s = step({ endpointId: "post", connectionId: "spa-other" });

    expect(findEndpointMismatch(s, cyclic, CONNECTIONS)).toEqual({
      arrivesAtId: "other",
      belongsToId: "group",
    });
  });
});
