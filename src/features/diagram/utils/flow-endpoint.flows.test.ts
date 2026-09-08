import { describe, expect, it } from "vitest";
import type { Component, EndpointComponent, Flow, FlowStep } from "@/features/diagram";
import { apiGroupFlows, endpointCallersByRoute, endpointFlows } from "./flow-endpoint";

/**
 * The scripts a route is associated with.
 *
 * The canvas asked one half of this question and truncated the answer:
 * `handlers?.[0]?.flowId` — the first handler of a route, and only a handler,
 * though a step naming the route it calls says the same thing from the other
 * side.
 */
function endpoint(id: string, handlerFlowIds: (string | undefined)[] = []): EndpointComponent {
  return {
    id,
    type: "endpoint",
    name: id,
    parentId: "g1",
    method: "POST",
    path: `/${id}`,
    handlers: handlerFlowIds.map((flowId, index) => ({ id: `h${index}`, label: "h", flowId })),
  } as EndpointComponent;
}

function flow(id: string, name: string, steps: Record<string, FlowStep> = {}): Flow {
  return { id, name, mermaid: "", diagramId: "d1", entryStepId: "s1", steps };
}

const calling = (id: string, name: string, endpointId: string) =>
  flow(id, name, { s1: { id: "s1", type: "action", endpointId } as FlowStep });

const FLOWS = [
  { id: "f1", name: "Criar URL" },
  { id: "f2", name: "Redirecionar" },
];
const NO_CALLERS = new Map<string, never[]>();

describe("the scripts a route is associated with", () => {
  it("names the script a handler points at", () => {
    expect(endpointFlows(endpoint("e1", ["f1"]), FLOWS, NO_CALLERS)).toEqual([
      { id: "f1", name: "Criar URL" },
    ]);
  });

  it("names the script whose step calls it, with no handler at all", () => {
    const callers = endpointCallersByRoute([calling("f2", "Redirecionar", "e1")]);

    expect(endpointFlows(endpoint("e1"), FLOWS, callers)).toEqual([
      { id: "f2", name: "Redirecionar" },
    ]);
  });

  it("names a script that does both only once", () => {
    const callers = endpointCallersByRoute([calling("f1", "Criar URL", "e1")]);

    expect(endpointFlows(endpoint("e1", ["f1"]), FLOWS, callers)).toEqual([
      { id: "f1", name: "Criar URL" },
    ]);
  });

  it("leaves out a handler naming a script that is gone", () => {
    expect(endpointFlows(endpoint("e1", ["deleted"]), FLOWS, NO_CALLERS)).toEqual([]);
  });

  it("reads every handler, not the first", () => {
    expect(endpointFlows(endpoint("e1", ["f1", "f2"]), FLOWS, NO_CALLERS)).toEqual([
      { id: "f1", name: "Criar URL" },
      { id: "f2", name: "Redirecionar" },
    ]);
  });

  it("has nothing for a route nothing runs through", () => {
    expect(endpointFlows(endpoint("e1"), FLOWS, NO_CALLERS)).toEqual([]);
  });

  it("survives a route with no handlers field at all", () => {
    const bare = { id: "e1", type: "endpoint", name: "e1", method: "GET", path: "/x" };

    expect(endpointFlows(bare as EndpointComponent, FLOWS, NO_CALLERS)).toEqual([]);
  });
});

describe("the scripts running through an api-group", () => {
  const components = (...endpoints: EndpointComponent[]): Record<string, Component> => {
    const map: Record<string, Component> = {
      g1: { id: "g1", type: "api-group", name: "api", parentId: null } as Component,
      // Not in the group, and not an endpoint: neither should be counted.
      other: { id: "other", type: "system", name: "elsewhere", parentId: "g1" } as Component,
    };
    for (const item of endpoints) map[item.id] = item;
    return map;
  };

  it("names a script from each of its routes", () => {
    const map = components(endpoint("e1", ["f1"]), endpoint("e2", ["f2"]));

    expect(apiGroupFlows("g1", map, FLOWS, NO_CALLERS)).toEqual([
      { id: "f1", name: "Criar URL" },
      { id: "f2", name: "Redirecionar" },
    ]);
  });

  it("names one script once however many routes it runs through", () => {
    const map = components(endpoint("e1", ["f1"]), endpoint("e2", ["f1"]));

    expect(apiGroupFlows("g1", map, FLOWS, NO_CALLERS)).toEqual([{ id: "f1", name: "Criar URL" }]);
  });

  it("has nothing for a group whose routes run nothing", () => {
    expect(apiGroupFlows("g1", components(endpoint("e1")), FLOWS, NO_CALLERS)).toEqual([]);
  });

  it("has nothing for a group with no routes in it", () => {
    expect(apiGroupFlows("g1", components(), FLOWS, NO_CALLERS)).toEqual([]);
  });
});
