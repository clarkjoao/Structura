import { describe, expect, it } from "vitest";
import type { Component } from "@/features/diagram";
// `./registry` first on purpose: importing card builders alone can re-enter
// the registry mid-initialisation. Same ordering as registry.test.ts.
import "./registry";
import { buildCardNodeData } from "../CustomNode/buildCardNodeData";
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
    childrenIndex: new Map(),
    isPlaying: false,
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

function dataFor(component: Component): Record<string, unknown> {
  return buildCardNodeData(component, buildContext());
}

const base = { id: "n1", name: "Node", description: "", parentId: null };

describe("buildCardNodeData — technology (C4 + cloud)", () => {
  it("passes technology through for a C4 container", () => {
    const data = dataFor({ ...base, type: "container", technology: "Node.js" } as Component);
    expect(data.technology).toBe("Node.js");
  });

  it("passes technology through for an AWS component", () => {
    const data = dataFor({
      ...base,
      type: "aws-compute",
      cloudServiceId: "fargate",
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
    const data = dataFor({ ...base, type: "aws-database", cloudServiceId: "rds" } as Component);
    expect(data.technology).toBeUndefined();
    expect(data.cloudService).toBe("rds");
  });

  it("leaves technology undefined for a type that has no such field", () => {
    const data = dataFor({ ...base, type: "note" } as Component);
    expect(data.technology).toBeUndefined();
  });
});
