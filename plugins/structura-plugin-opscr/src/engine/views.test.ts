/**
 * Showing an opscr View on the bound diagram: the canvas swaps to the view's projection, its
 * positions go to the view's own sidecar entry, and its structure is not edited from the canvas.
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { describe, expect, it } from "vitest";
import { LAYOUT_FILE, layoutFor } from "../generated/opscr-mapping";
import { projector } from "../project";
import { OpscrEngine, type EngineEvent } from "./engine";
import { FakeCanvas } from "./fake-canvas.fixture";
import type { SourceText } from "./patches";
import { emptyBinding, type BindingState } from "./sync";

const root = dirname(createRequire(import.meta.url).resolve("opscr/package.json"));
const git = (...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" });
const PREFIX = "examples/web-app-aws/";
const EXAMPLE: SourceText[] = git("ls-tree", "-r", "--name-only", "HEAD", PREFIX)
  .split("\n")
  .filter((p) => p.endsWith(".opscr.yaml"))
  .map((p) => ({ name: p.slice(PREFIX.length), text: git("show", `HEAD:${p}`) }));

class Session {
  canvas = new FakeCanvas();
  binding: BindingState = emptyBinding();
  events: EngineEvent[] = [];
  files: SourceText[] = [...EXAMPLE.map((f) => ({ ...f })), { name: LAYOUT_FILE, text: "" }];
  engine = new OpscrEngine({
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
    diagram: { get: () => this.canvas.snapshot(), apply: (changes) => this.canvas.apply(changes) },
    binding: { get: () => this.binding, set: (state) => void (this.binding = state) },
    project: projector,
    isManifest: (name) => name.endsWith(".opscr.yaml"),
    configFile: "opscr.config.yaml",
    onEvent: (event) => void this.events.push(event),
  });
  labels = () => this.canvas.components.map((c) => c.label).sort();
  text = (name: string) => this.files.find((f) => f.name === name)?.text ?? "";
  lastViews = () => this.events.filter((e) => e.type === "views").at(-1);
}

describe("showView", () => {
  it("swaps the canvas to the view and back", async () => {
    const s = new Session();
    await s.engine.sync();
    expect(s.labels()).not.toContain("customer");

    await s.engine.showView("shop-context");
    expect(s.binding.view).toBe("shop-context");
    expect(s.labels()).toEqual(["customer", "payment-provider", "webshop"]);

    await s.engine.showView(undefined);
    expect(s.binding.view).toBeUndefined();
    expect(s.labels()).not.toContain("customer");
    expect(s.labels()).toContain("orders-api");
  });

  it("reports the views and the boxes that open another one", async () => {
    const s = new Session();
    await s.engine.sync();
    expect(s.lastViews()).toMatchObject({ current: undefined, links: [] });
    await s.engine.showView("shop-containers");
    const views = s.lastViews();
    expect(views).toMatchObject({ current: "shop-containers" });
    expect(views && "views" in views ? views.views.sort() : []).toEqual([
      "orders-api-components",
      "shop-containers",
      "shop-context",
      "shop-production",
    ]);
    expect(
      views && "links" in views ? views.links.map((l) => `${l.name}→${l.view}`).sort() : [],
    ).toEqual(["orders-api→orders-api-components", "webshop→shop-production"]);
  });

  it("keeps each view's positions in its own sidecar entry, beside the default diagram's", async () => {
    const s = new Session();
    await s.engine.sync();
    await s.engine.showView("shop-containers");
    const web = s.canvas.components.find((c) => c.label === "storefront")!;
    s.canvas.step(() => (web.position = { x: 640, y: 320 }));
    await s.engine.canvasChanged();
    expect(
      layoutFor(s.text(LAYOUT_FILE), "shop-containers")!.boxes.get("Application/storefront"),
    ).toMatchObject({ x: 640, y: 320 });
    expect(layoutFor(s.text(LAYOUT_FILE), undefined)!.boxes.has("Application/orders-api")).toBe(
      true,
    );

    // Leaving and coming back puts the box where the reader left it.
    await s.engine.showView("shop-context");
    await s.engine.showView("shop-containers");
    expect(s.canvas.components.find((c) => c.label === "storefront")!.position).toMatchObject({
      x: 640,
      y: 320,
    });
  });

  it("does not edit the YAML from the canvas while a view is shown", async () => {
    const s = new Session();
    await s.engine.sync();
    await s.engine.showView("shop-containers");
    const before = s.files.map((f) => f.text);
    s.canvas.step(() =>
      s.canvas.remove([s.canvas.components.find((c) => c.label === "sessions")!.id]),
    );
    await s.engine.canvasChanged();
    await s.engine.sync();
    expect(s.files.filter((f) => f.name.endsWith(".opscr.yaml")).map((f) => f.text)).toEqual(
      before.slice(0, EXAMPLE.length),
    );
    expect(s.labels()).toContain("sessions");
  });

  it("reports an element drawn on a view as outside the YAML, and keeps it for the whole workspace", async () => {
    const s = new Session();
    await s.engine.sync();
    await s.engine.showView("shop-production");
    s.canvas.apply({ add: [{ key: "new", name: "ledger-db", type: "container", x: 0, y: 0 }] });
    const drawn = s.canvas.components.find((c) => c.label === "ledger-db")!.id;
    await s.engine.canvasChanged();
    const outside = () => s.events.filter((e) => e.type === "outside").at(-1);
    expect(outside()).toEqual({ type: "outside", ids: [drawn] });

    await s.engine.showView(undefined);
    expect(s.labels()).toContain("ledger-db");
    expect(outside()).toEqual({ type: "outside", ids: [drawn] });
  });

  it("follows the YAML while a view is shown", async () => {
    const s = new Session();
    await s.engine.sync();
    await s.engine.showView("shop-context");
    const shop = s.files.find((f) => f.name === "shop.opscr.yaml")!;
    shop.text = shop.text.replace("Buys products from the web shop", "Orders gifts");
    await s.engine.sync();
    expect(s.canvas.components.find((c) => c.label === "customer")!.description).toBe(
      "Orders gifts",
    );
  });
});
