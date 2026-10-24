import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { describe, expect, it } from "vitest";
import { projectView } from "./project";

/** The web-app-aws example as committed in the linked opscr checkout (see test-sample.ts). */
const root = dirname(createRequire(import.meta.url).resolve("opscr/package.json"));
const git = (...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" });
const PREFIX = "examples/web-app-aws/";
const FILES = git("ls-tree", "-r", "--name-only", "HEAD", PREFIX)
  .split("\n")
  .filter((p) => p.endsWith(".opscr.yaml"))
  .map((p) => ({ path: p.slice(PREFIX.length), content: git("show", `HEAD:${p}`) }));

const byKey = (graph: { components: Array<{ key: string }> }, key: string) =>
  graph.components.find((c) => c.key === key) as Record<string, unknown> | undefined;

describe("projectView", () => {
  it("lists the views of the workspace", async () => {
    const { views, diagnostics } = await projectView(FILES, undefined, "shop-context");
    expect(views.sort()).toEqual(["orders-api-components", "shop-containers", "shop-context", "shop-production"]);
    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  });

  it("context: the system as a box with the link to the container view", async () => {
    const { graph } = await projectView(FILES, undefined, "shop-context");
    expect(graph!.components.map((c) => c.key).sort()).toEqual([
      "BoundedContext/webshop",
      "ExternalSystem/payment-provider",
      "Person/customer",
    ]);
    expect(byKey(graph!, "BoundedContext/webshop")).toMatchObject({ type: "system", linkedView: "shop-containers" });
    expect(byKey(graph!, "Person/customer")).toMatchObject({ type: "person" });
    expect(graph!.connections).toHaveLength(2);
  });

  it("containers: a panel for the system, catalog icons for what runs in it, and two drill-downs", async () => {
    const { graph } = await projectView(FILES, undefined, "shop-containers");
    expect(byKey(graph!, "BoundedContext/webshop")).toMatchObject({ type: "panel", linkedView: "shop-production" });
    expect(byKey(graph!, "Application/orders-api")).toMatchObject({
      parentKey: "BoundedContext/webshop",
      type: "aws-compute",
      cloudServiceId: "fargate",
      linkedView: "orders-api-components",
    });
    expect(byKey(graph!, "Database/orders-db")).toMatchObject({ type: "aws-database", cloudServiceId: "aurora" });
  });

  it("deployment: AWS group panels nested zone → subnet, holding the deployed things", async () => {
    const { graph } = await projectView(FILES, undefined, "shop-production");
    expect(byKey(graph!, "DeploymentNode/az-a")).toMatchObject({ type: "panel", panelKind: "availability-zone", parentKey: "DeploymentNode/eu-west-1" });
    expect(byKey(graph!, "DeploymentNode/public-a")).toMatchObject({ panelKind: "public-subnet" });
    expect(byKey(graph!, "DeploymentNode/private-a")).toMatchObject({ panelKind: "private-subnet" });
    expect(byKey(graph!, "Application/storefront")).toMatchObject({ parentKey: "DeploymentNode/private-a" });
    expect(byKey(graph!, "LoadBalancer/shop-alb")).toMatchObject({ parentKey: "DeploymentNode/public-a" });
  });

  it("lays every box out and keeps a box the reader placed", async () => {
    const first = await projectView(FILES, undefined, "shop-containers");
    const web = byKey(first.graph!, "Application/storefront") as { x: number; y: number };
    expect(Number.isFinite(web.x) && Number.isFinite(web.y)).toBe(true);
    const placed = new Map(first.graph!.components.map((c) => [c.key, { x: c.x, y: c.y, width: c.width ?? 180, height: c.height ?? 80 }]));
    placed.set("Application/storefront", { x: 777, y: 333, width: 180, height: 80 });
    const second = await projectView(FILES, undefined, "shop-containers", { boxes: placed, edgeRoutes: new Map() });
    expect(byKey(second.graph!, "Application/storefront")).toMatchObject({ x: 777, y: 333 });
  });

  it("returns no graph for an unknown view", async () => {
    const { graph, views } = await projectView(FILES, undefined, "nope");
    expect(graph).toBeUndefined();
    expect(views.length).toBe(4);
  });
});
