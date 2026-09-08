import { describe, expect, it } from "vitest";
import type { Component, EndpointCall, FlowRef } from "@/features/diagram";
// `./registry` first on purpose — see the note in `c4.descriptor.test.ts`.
import "./registry";
import { apiGroupDescriptor } from "./apigroup.descriptor";
import { endpointDescriptor } from "./endpoint.descriptor";
import type { NodeBuildContext } from "./types";

/**
 * What a route offers on the canvas.
 *
 * It used to be `ctx.activeFlowId ?? handlers[0].flowId`, and both halves were
 * wrong. The first put a play button on *every* route on the diagram while a
 * reading ran, all of them for the script being read; the second ignored every
 * handler after the first.
 */
function context(
  overrides: {
    flows?: FlowRef[];
    calls?: [string, EndpointCall[]][];
    components?: Record<string, Component>;
    isPlaying?: boolean;
  } = {},
): NodeBuildContext {
  return {
    diagram: { id: "d", name: "d" },
    flows: overrides.flows ?? [],
    endpointCallsByRoute: new Map(overrides.calls ?? []),
    resolvedComponents: overrides.components ?? {},
    resolvedNodeLayouts: {},
    sceneBadgeByComponentId: {},
    serviceCatalog: {},
    allDiagrams: {},
    selectedNodeId: null,
    selectedNodeIds: new Set<string>(),
    dragTargetPanelId: null,
    unparentCandidatePanelId: null,
    panelIds: new Set<string>(),
    connectionCounts: {},
    effectiveHandleOrder: {},
    childrenIndex: new Map(),
    isPlaying: overrides.isPlaying ?? false,
    isRecording: false,
    flowHighlight: {
      activeNodeId: null,
      visitedNodeIds: new Set<string>(),
      participantNodeIds: new Set<string>(),
    },
    activeStep: null,
    flowBadges: null,
    coverage: null,
  } as unknown as NodeBuildContext;
}

const route = (handlerFlowIds: string[] = []) =>
  ({
    id: "e1",
    type: "endpoint",
    name: "/urls",
    parentId: "g1",
    method: "POST",
    path: "/urls",
    handlers: handlerFlowIds.map((flowId, index) => ({ id: `h${index}`, label: "h", flowId })),
  }) as unknown as Component;

const group = () =>
  ({
    id: "g1",
    type: "api-group",
    name: "api",
    parentId: null,
    serviceName: "management",
    basePath: "/api/v1",
    protocol: "REST",
  }) as unknown as Component;

const CREATE: FlowRef = { id: "f1", name: "Create URL" };
const REDIRECT: FlowRef = { id: "f2", name: "Redirect" };
const call = (flow: FlowRef): EndpointCall => ({
  flowId: flow.id,
  flowName: flow.name,
  stepId: "s1",
});

const flowsOf = (data: Record<string, unknown>) => data.flows as FlowRef[];

describe("what a route offers", () => {
  it("names the script its handler points at", () => {
    const data = endpointDescriptor.buildData(route(["f1"]), context({ flows: [CREATE] }));

    expect(flowsOf(data)).toEqual([CREATE]);
  });

  it("names every handler, not the first", () => {
    const data = endpointDescriptor.buildData(
      route(["f1", "f2"]),
      context({ flows: [CREATE, REDIRECT] }),
    );

    expect(flowsOf(data)).toEqual([CREATE, REDIRECT]);
  });

  it("names the script whose step calls it", () => {
    const data = endpointDescriptor.buildData(
      route(),
      context({ flows: [REDIRECT], calls: [["e1", [call(REDIRECT)]]] }),
    );

    expect(flowsOf(data)).toEqual([REDIRECT]);
  });

  it("offers nothing on a route nothing runs through, reading or not", () => {
    const idle = endpointDescriptor.buildData(route(), context({ flows: [CREATE] }));
    const reading = endpointDescriptor.buildData(
      route(),
      context({ flows: [CREATE], isPlaying: true }),
    );

    expect(flowsOf(idle)).toEqual([]);
    expect(flowsOf(reading)).toEqual([]);
  });

  it("still reports who calls it, by name, apart from what it offers", () => {
    const data = endpointDescriptor.buildData(
      route(["f1"]),
      context({ flows: [CREATE, REDIRECT], calls: [["e1", [call(REDIRECT), call(REDIRECT)]]] }),
    );

    expect(data.callerNames).toEqual(["Redirect"]);
    expect(flowsOf(data)).toEqual([CREATE, REDIRECT]);
  });
});

describe("what a group offers", () => {
  it("names the scripts running through its routes", () => {
    const components = { g1: group(), e1: route(["f1"]) };
    const data = apiGroupDescriptor.buildData(group(), context({ flows: [CREATE], components }));

    expect(flowsOf(data)).toEqual([CREATE]);
  });

  it("names nothing for a group whose routes run nothing", () => {
    const components = { g1: group(), e1: route() };
    const data = apiGroupDescriptor.buildData(group(), context({ flows: [CREATE], components }));

    expect(flowsOf(data)).toEqual([]);
  });
});
