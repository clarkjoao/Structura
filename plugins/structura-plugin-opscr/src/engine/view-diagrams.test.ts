/**
 * One diagram per View: the diagrams are made, filled, linked and kept in sync from the YAML, on a
 * host that, like Structura's, keeps several diagrams and changes each one separately.
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { LAYOUT_FILE, layoutFor } from "../generated/opscr-mapping";
import { projector } from "../project";
import type { PluginDiagramInput } from "../types/plugin.types";
import { FakeCanvas } from "./fake-canvas.fixture";
import type { SourceText } from "./patches";
import {
  ViewDiagrams,
  emptyViewDiagrams,
  type DiagramsPort,
  type ViewDiagramsEvent,
  type ViewDiagramsState,
} from "./view-diagrams";

const root = dirname(createRequire(import.meta.url).resolve("opscr/package.json"));
const git = (...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" });
const PREFIX = "examples/web-app-aws/";
const EXAMPLE: SourceText[] = git("ls-tree", "-r", "--name-only", "HEAD", PREFIX)
  .split("\n")
  .filter((p) => p.endsWith(".opscr.yaml"))
  .map((p) => ({ name: p.slice(PREFIX.length), text: git("show", `HEAD:${p}`) }));

/** A host with several diagrams: what the plugin API 1.13 gives, in memory. */
class FakeHost implements DiagramsPort {
  canvases = new Map<string, FakeCanvas>();
  created: Array<PluginDiagramInput & { id: string }> = [];
  private next = 0;
  createDiagram(input: PluginDiagramInput): string {
    const id = `dg${this.next++}`;
    this.canvases.set(id, new FakeCanvas(id));
    this.created.push({ ...input, id });
    return id;
  }
  getDiagram(id: string) {
    return this.canvases.get(id)?.snapshot() ?? null;
  }
  applyChanges(changes: Parameters<DiagramsPort["applyChanges"]>[0], id: string) {
    const canvas = this.canvases.get(id);
    return canvas ? canvas.apply(changes) : { idsByKey: {}, connectionIds: [] };
  }
  /** The user deletes a diagram in the app. */
  delete(id: string) {
    this.canvases.delete(id);
  }
}

class Session {
  host = new FakeHost();
  state: ViewDiagramsState = emptyViewDiagrams();
  events: ViewDiagramsEvent[] = [];
  files: SourceText[] = [...EXAMPLE.map((f) => ({ ...f })), { name: LAYOUT_FILE, text: "" }];
  manager = new ViewDiagrams({
    host: this.host,
    texts: {
      get: () => this.files,
      set: (files) => {
        for (const file of files) {
          const i = this.files.findIndex((f) => f.name === file.name);
          if (i >= 0) this.files[i] = { ...file };
          else this.files.push({ ...file });
        }
      },
    },
    state: { get: () => this.state, set: (state) => void (this.state = state) },
    project: projector,
    isManifest: (name) => name.endsWith(".opscr.yaml"),
    configFile: "opscr.config.yaml",
    onEvent: (event) => void this.events.push(event),
  });
  canvasOf = (view: string) => this.host.canvases.get(this.state.diagrams[view]!)!;
  labels = (view: string) => this.canvasOf(view).components.map((c) => c.label).sort();
  text = (name: string) => this.files.find((f) => f.name === name)?.text ?? "";
  lastReport = () =>
    this.events.filter((e) => e.type === "view-diagrams").at(-1) as
      | Extract<ViewDiagramsEvent, { type: "view-diagrams" }>
      | undefined;
}

let s: Session;
beforeEach(() => {
  s = new Session();
});

describe("ViewDiagrams", () => {
  it("makes one diagram per view, named and levelled after it, and fills each", async () => {
    await s.manager.sync();
    expect(Object.keys(s.state.diagrams).sort()).toEqual([
      "orders-api-components",
      "shop-containers",
      "shop-context",
      "shop-production",
    ]);
    expect(s.host.created.map((c) => [c.name, c.level]).sort()).toEqual([
      ["Orders API — components", "component"],
      ["Web shop — containers", "container"],
      ["Web shop — production on AWS", "deployment"],
      ["Web shop — system context", "context"],
    ]);
    expect(s.canvasOf("shop-context").components).toHaveLength(3);
    expect(s.canvasOf("shop-containers").components).toHaveLength(10);
    expect(s.canvasOf("orders-api-components").components).toHaveLength(8);
    expect(s.canvasOf("shop-production").components).toHaveLength(18);
  });

  it("links a box that opens another view to that view's diagram", async () => {
    await s.manager.sync();
    const link = (view: string, label: string) =>
      s.canvasOf(view).components.find((c) => c.label === label)?.linkedDiagramId;
    expect(link("shop-context", "webshop")).toBe(s.state.diagrams["shop-containers"]);
    expect(link("shop-containers", "orders-api")).toBe(s.state.diagrams["orders-api-components"]);
    expect(link("shop-containers", "webshop")).toBe(s.state.diagrams["shop-production"]);
    expect(link("shop-containers", "storefront")).toBeNull();
  });

  it("changes nothing the second time", async () => {
    await s.manager.sync();
    const made = s.host.created.length;
    const before = [...s.host.canvases].map(([id, c]) => [id, JSON.stringify(c.components)]);
    await s.manager.sync();
    expect(s.host.created).toHaveLength(made);
    expect([...s.host.canvases].map(([id, c]) => [id, JSON.stringify(c.components)])).toEqual(before);
  });

  it("follows an edit of the YAML in every diagram that shows the element", async () => {
    await s.manager.sync();
    const shop = s.files.find((f) => f.name === "shop.opscr.yaml")!;
    shop.text = shop.text.replace("Takes and tracks orders", "Takes, prices and tracks orders");
    await s.manager.sync();
    for (const view of ["shop-containers", "orders-api-components"]) {
      expect(s.canvasOf(view).components.find((c) => c.label === "orders-api")?.description).toBe(
        "Takes, prices and tracks orders",
      );
    }
  });

  it("makes the diagram again when the user deleted it, and links to the new one", async () => {
    await s.manager.sync();
    const old = s.state.diagrams["shop-containers"]!;
    s.host.delete(old);
    await s.manager.sync();
    const fresh = s.state.diagrams["shop-containers"]!;
    expect(fresh).not.toBe(old);
    expect(s.canvasOf("shop-containers").components).toHaveLength(10);
    expect(s.state.bindings[old]).toBeUndefined();
    const context = s.canvasOf("shop-context").components.find((c) => c.label === "webshop");
    expect(context?.linkedDiagramId).toBe(fresh);
  });

  it("keeps the diagram of a view that left the YAML, and lists it as an orphan", async () => {
    await s.manager.sync();
    const gone = s.state.diagrams["orders-api-components"]!;
    s.files = s.files.filter((f) => f.name !== "orders-api-components.opscr.yaml");
    await s.manager.sync();
    expect(s.host.canvases.has(gone)).toBe(true);
    expect(s.lastReport()?.orphans).toEqual([{ view: "orders-api-components", diagramId: gone }]);
    expect(s.lastReport()?.diagrams.map((d) => d.view).sort()).toEqual([
      "shop-containers",
      "shop-context",
      "shop-production",
    ]);
    // The box that opened it no longer does.
    expect(
      s.canvasOf("shop-containers").components.find((c) => c.label === "orders-api")?.linkedDiagramId,
    ).toBeNull();
  });

  it("makes a diagram for a view added later", async () => {
    await s.manager.sync();
    s.files.push({
      name: "shop-extra.opscr.yaml",
      text: "apiVersion: opscr.dev/v1\nkind: View\nmetadata:\n  name: shop-extra\nspec:\n  type: Container\n  scope: { kind: BoundedContext, id: webshop }\n",
    });
    await s.manager.sync();
    expect(s.state.diagrams["shop-extra"]).toBeDefined();
    expect(s.canvasOf("shop-extra").components.length).toBeGreaterThan(0);
  });

  it("does nothing while the YAML does not parse", async () => {
    await s.manager.sync();
    const before = JSON.stringify([...s.host.canvases].map(([id, c]) => [id, c.components]));
    s.files.find((f) => f.name === "shop.opscr.yaml")!.text += "\n  : : bad: [unclosed";
    await s.manager.sync();
    expect(JSON.stringify([...s.host.canvases].map(([id, c]) => [id, c.components]))).toBe(before);
    expect(s.host.created).toHaveLength(4);
  });

  it("writes nothing to the sidecar for drawing alone", async () => {
    const before = s.text(LAYOUT_FILE);
    await s.manager.sync();
    await s.manager.canvasChanged(s.canvasOf("shop-containers").id);
    expect(s.text(LAYOUT_FILE)).toBe(before);
  });

  it("keeps each diagram's positions in its own entry of the sidecar", async () => {
    await s.manager.sync();
    const containers = s.canvasOf("shop-containers");
    const storefront = containers.components.find((c) => c.label === "storefront")!;
    containers.step(() => (storefront.position = { x: 640, y: 320 }));
    await s.manager.canvasChanged(containers.id);
    const sidecar = s.text(LAYOUT_FILE);
    expect(layoutFor(sidecar, "shop-containers")!.boxes.get("Application/storefront")).toMatchObject({ x: 640, y: 320 });
    // Another view, where nothing moved, gets no entry from it.
    expect(layoutFor(sidecar, "shop-context")?.boxes.has("Application/storefront") ?? false).toBe(
      false,
    );
  });

  it("puts a box where the sidecar says when it changes outside", async () => {
    await s.manager.sync();
    const containers = s.canvasOf("shop-containers");
    const moved = JSON.stringify({
      version: 2,
      views: { "shop-containers": { "Application/storefront": { x: 777, y: 333, width: 200, height: 90 } } },
    });
    await s.manager.sidecarChanged(moved);
    expect(containers.components.find((c) => c.label === "storefront")!.position).toMatchObject({ x: 777, y: 333 });
  });

  it("does not edit the YAML from any of these diagrams", async () => {
    await s.manager.sync();
    const before = s.files.map((f) => f.text);
    const containers = s.canvasOf("shop-containers");
    containers.step(() => containers.remove([containers.components.find((c) => c.label === "sessions")!.id]));
    await s.manager.canvasChanged(containers.id);
    await s.manager.sync();
    expect(s.files.filter((f) => f.name.endsWith(".opscr.yaml")).map((f) => f.text)).toEqual(
      before.slice(0, EXAMPLE.length),
    );
    expect(s.labels("shop-containers")).toContain("sessions");
  });

  it("reports the diagrams it made", async () => {
    await s.manager.sync();
    expect(s.lastReport()?.diagrams).toHaveLength(4);
    expect(s.lastReport()?.orphans).toEqual([]);
    expect(s.manager.viewOf(s.state.diagrams["shop-context"]!)).toBe("shop-context");
    expect(s.manager.viewOf("nope")).toBeUndefined();
    expect(s.manager.diagramIds()).toHaveLength(4);
  });
});
