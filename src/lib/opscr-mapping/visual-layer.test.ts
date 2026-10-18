import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { AWS_CATEGORIES } from "@/features/cloud/providers/aws/aws.catalog";
import { AZURE_CATEGORIES } from "@/features/cloud/providers/azure/azure.catalog";
import { GCP_CATEGORIES } from "@/features/cloud/providers/gcp/gcp.catalog";
import { OSS_CATEGORIES } from "@/features/elements/families/oss/oss.catalog";
import { PanelKind } from "@/features/diagram/enums";
import { buildTechnicalView } from "./technical-view";
import { parseLayoutFile } from "./layout-file";
import { placeView } from "./layout";
import { toImporterGraph, type ImporterGraph, type ImporterGraphComponent } from "./importer-graph";
import {
  VISUAL_SERVICES,
  boundaryPanelKind,
  parseVisualFile,
  withVisualLayer,
  type VisualFile,
} from "./visual-layer";
import type { OpscrManifestInput } from "./types";

interface Fixture {
  manifests: OpscrManifestInput[];
  layout: string;
  visual: string;
}

const fixture = (name: string): Fixture =>
  JSON.parse(readFileSync(`${__dirname}/__fixtures__/${name}.import.json`, "utf8")) as Fixture;

/** The importer graph the plugin draws for an imported workspace, before the visual layer. */
function technicalGraph(f: Fixture): ImporterGraph {
  const view = buildTechnicalView({ manifests: f.manifests });
  return toImporterGraph(placeView(view, parseLayoutFile(f.layout)!));
}

function draw(name: string) {
  const f = fixture(name);
  const before = technicalGraph(f);
  return { before, ...withVisualLayer(before, parseVisualFile(f.visual)!) };
}

const byName = (graph: ImporterGraph, name: string) =>
  graph.components.filter((c) => c.name === name);
const one = (graph: ImporterGraph, name: string): ImporterGraphComponent => {
  const found = byName(graph, name);
  expect(found, name).toHaveLength(1);
  return found[0]!;
};
const parentName = (graph: ImporterGraph, c: ImporterGraphComponent) =>
  graph.components.find((p) => p.key === c.parentKey)?.name;
const absolute = (graph: ImporterGraph, key: string): { x: number; y: number } => {
  const c = graph.components.find((x) => x.key === key)!;
  const p = c.parentKey ? absolute(graph, c.parentKey) : { x: 0, y: 0 };
  return { x: p.x + c.x, y: p.y + c.y };
};

describe("parseVisualFile", () => {
  it("reads version 1, skips malformed entries, refuses anything else", () => {
    const visual = parseVisualFile(fixture("example-microservices").visual)!;
    expect(visual.version).toBe(1);
    expect(Object.keys(visual.elements).length).toBeGreaterThan(5);
    expect(parseVisualFile("{ not json")).toBeNull();
    expect(parseVisualFile('{"version":2,"elements":{}}')).toBeNull();
    const partial = parseVisualFile(
      '{"version":1,"elements":{"drawio:a":{"role":"service"},"drawio:b":{"role":"service","box":{"x":0,"y":0,"width":1,"height":1}}},"edges":[]}',
    )!;
    expect(Object.keys(partial.elements)).toEqual(["drawio:b"]);
  });

  it("an empty layer leaves the graph as it is", () => {
    const f = fixture("example-microservices");
    const before = technicalGraph(f);
    const empty: VisualFile = {
      version: 1,
      source: { file: "", page: "" },
      elements: {},
      edges: [],
    };
    expect(withVisualLayer(before, empty)).toEqual({ graph: before, drawnThrough: [] });
  });
});

describe("boundaries", () => {
  it("AWS deployment boundaries become nested panels of their kinds", () => {
    const { graph } = draw("aws-simple-architecture");
    const cloud = one(graph, "AWS Cloud");
    const vpc = one(graph, "VPC");
    expect(cloud).toMatchObject({ type: "panel" });
    expect(cloud.panelKind).toBeUndefined();
    expect(vpc).toMatchObject({ type: "panel", panelKind: PanelKind.Vpc });
    expect(parentName(graph, vpc)).toBe("AWS Cloud");
    const az = one(graph, "Availability Zone 1");
    expect(az.panelKind).toBe(PanelKind.AvailabilityZone);
    expect(parentName(graph, az)).toBe("VPC");
    expect(one(graph, "Private Subnet 1")).toMatchObject({ panelKind: PanelKind.PrivateSubnet });
    expect(parentName(graph, one(graph, "Private Subnet 1"))).toBe("Availability Zone 1");
    for (const asg of byName(graph, "Auto Scaling group"))
      expect(asg.panelKind).toBe(PanelKind.AutoScalingGroup);
    expect(one(graph, "Public DMZ1").panelKind).toBe(PanelKind.PublicSubnet);
  });

  it("a bounded context inside a VPC keeps its applications", () => {
    const { graph } = draw("aws-simple-architecture");
    const frontEnd = graph.components.find((c) => c.key === "ApplicationService/front-end")!;
    expect(parentName(graph, frontEnd)).toBe("VPC");
    const cluster = graph.components.find((c) => c.key === "Application/confluence-cluster-1")!;
    expect(parentName(graph, cluster)).toBe("Auto Scaling group");
    const asg = graph.components.find((c) => c.key === cluster.parentKey)!;
    expect(asg.parentKey).toBe("ApplicationService/front-end");
  });

  it("panel kinds follow the hint and the label", () => {
    expect(boundaryPanelKind("generic:subnet", "Public Subnet")).toBe(PanelKind.PublicSubnet);
    expect(boundaryPanelKind("generic:subnet", "Public DMZ")).toBe(PanelKind.PublicSubnet);
    expect(boundaryPanelKind("generic:subnet", "App tier")).toBe(PanelKind.PrivateSubnet);
    expect(boundaryPanelKind("generic:cluster", "EKS prod")).toBe(PanelKind.EksCluster);
    expect(boundaryPanelKind("generic:cluster", "ECS cluster")).toBe(PanelKind.EcsCluster);
    expect(boundaryPanelKind("generic:region", "Region: us-east-1")).toBeUndefined();
  });
});

describe("services without a Kind", () => {
  it("monitoring and tracing are catalog components", () => {
    const { graph } = draw("example-microservices");
    const services = graph.components.filter(
      (c) => c.cloudServiceId === "cloudwatch" || c.cloudServiceId === "xray",
    );
    expect(services.map((c) => [c.type, c.cloudServiceId]).sort()).toEqual([
      ["aws-developer", "xray"],
      ["aws-management", "cloudwatch"],
    ]);
  });

  it("VPC gateways and addresses are their catalog resources", () => {
    const { graph } = draw("aws-simple-architecture");
    expect(one(graph, "Internet Gateway")).toMatchObject({
      type: "aws-networking",
      cloudServiceId: "internet-gateway",
    });
    for (const ip of byName(graph, "Elastic IP"))
      expect(ip).toMatchObject({ type: "aws-networking", cloudServiceId: "elastic-ip" });
  });

  it("an unmapped service is an unknown component with its label", () => {
    const visual: VisualFile = {
      version: 1,
      source: { file: "", page: "" },
      elements: {
        "drawio:o": {
          role: "service",
          hint: "generic:observability-x",
          label: "Orchestration",
          style: "",
          box: { x: 0, y: 0, width: 60, height: 60 },
          parent: null,
        },
      },
      edges: [],
    };
    const { graph } = withVisualLayer({ components: [], connections: [] }, visual);
    expect(graph.components[0]).toMatchObject({
      key: "drawio:o",
      type: "unknown",
      name: "Orchestration",
    });
  });

  it("names only services that exist in Structura's catalogs", () => {
    const catalogs = [...AWS_CATEGORIES, ...GCP_CATEGORIES, ...AZURE_CATEGORIES, ...OSS_CATEGORIES];
    const known = new Set(
      catalogs.flatMap((category) =>
        category.services.map((service) => `${category.id}/${service.id}`),
      ),
    );
    for (const [hint, service] of Object.entries(VISUAL_SERVICES)) {
      expect(known.has(`${service.type}/${service.catalogServiceId}`), hint).toBe(true);
    }
  });
});

describe("decoration", () => {
  it("titles and notes are text; badges and bare shapes are not drawn", () => {
    const { graph } = draw("example-microservices");
    const texts = graph.components.filter((c) => c.type === "text").map((c) => c.name);
    expect(texts).toContain("Microservices on ECS Fargate");
    expect(texts.every((t) => t.length >= 2)).toBe(true);
    expect(texts).not.toContain("1");
  });
});

describe("edges", () => {
  it("a collapsed CDN chain is drawn as the chain, not as a direct edge", () => {
    const { before, graph, drawnThrough } = draw("example-microservices");
    const users = "Channel/users";
    const alb =
      graph.components.find((c) => c.type === "aws-networking" && c.key.startsWith("LoadBalancer/"))
        ?.key ?? "LoadBalancer/path-routing";
    expect(before.connections.some((c) => c.source === users && c.target === alb)).toBe(true);
    expect(graph.connections.some((c) => c.source === users && c.target === alb)).toBe(false);
    expect(
      graph.connections.some((c) => c.source === users && c.target.startsWith("drawio:")),
    ).toBe(true);
    expect(drawnThrough).toHaveLength(1);
    expect(drawnThrough[0]!.edge).toBe(`${users} -calls-> ${alb}`);
    expect(drawnThrough[0]!.via.join(" ")).toMatch(/DNS|Route 53/);
  });
});

describe("positions", () => {
  it("every manifest element stays where the drawing put it, whichever panel now holds it", () => {
    const { before, graph } = draw("aws-simple-architecture");
    for (const c of before.components) {
      const was = absolute(before, c.key);
      const now = absolute(graph, c.key);
      expect(Math.abs(now.x - was.x), c.key).toBeLessThanOrEqual(1);
      expect(Math.abs(now.y - was.y), c.key).toBeLessThanOrEqual(1);
    }
  });
});
