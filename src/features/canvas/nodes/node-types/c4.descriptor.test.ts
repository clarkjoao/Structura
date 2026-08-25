import { describe, expect, it } from "vitest";
import type { Component } from "@/features/diagram";
// `./registry` first on purpose: importing the descriptor on its own re-enters
// the registry mid-initialisation and it builds an incomplete node-type map.
// `registry.test.ts` relies on the same ordering.
import "./registry";
import { c4Descriptor } from "./c4.descriptor";
import type { NodeBuildContext } from "./types";

/** Minimal context: `buildData` only reads these for a plain node. */
function buildContext(): NodeBuildContext {
  return {
    diagram: { id: "d", name: "d" },
    flows: [],
    resolvedComponents: {},
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
    activeFlowId: null,
    childrenIndex: new Map(),
    isPlaying: false,
    isRecording: false,
    flowHighlight: {
      activeNodeId: null,
      visitedNodeIds: new Set<string>(),
      participantNodeIds: new Set<string>(),
    },
    activeStep: null,
    recordingInfo: null,
    coverage: null,
  } as unknown as NodeBuildContext;
}

function dataFor(component: Component): Record<string, unknown> {
  return c4Descriptor.buildData(component, buildContext()) as Record<string, unknown>;
}

const base = { id: "n1", name: "Node", description: "", parentId: null };

describe("c4Descriptor — technology", () => {
  it("passes technology through for a C4 container", () => {
    const data = dataFor({ ...base, type: "container", technology: "Node.js" } as Component);
    expect(data.technology).toBe("Node.js");
  });

  it("passes technology through for an AWS component", () => {
    const data = dataFor({
      ...base,
      type: "aws-compute",
      awsService: "fargate",
      technology: "Fargate",
    } as Component);
    expect(data.technology).toBe("Fargate");
  });

  it("passes technology through for GCP and Azure components", () => {
    expect(
      dataFor({ ...base, type: "gcp-compute", technology: "Cloud Run" } as Component).technology,
    ).toBe("Cloud Run");
    expect(
      dataFor({ ...base, type: "azure-compute", technology: "App Service" } as Component)
        .technology,
    ).toBe("App Service");
  });

  it("leaves technology undefined on an AWS node that has none", () => {
    // The canvas falls back to the category name in this case, which is what
    // keeps already-saved diagrams looking the way they did.
    const data = dataFor({ ...base, type: "aws-database", awsService: "rds" } as Component);
    expect(data.technology).toBeUndefined();
    expect(data.awsService).toBe("rds");
  });

  it("leaves technology undefined for a type that has no such field", () => {
    const data = dataFor({ ...base, type: "note" } as Component);
    expect(data.technology).toBeUndefined();
  });
});
