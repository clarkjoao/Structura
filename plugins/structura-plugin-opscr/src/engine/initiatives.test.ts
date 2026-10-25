/**
 * Initiatives as Versions: drawn from the root with the initiative applied, canvas edits in a
 * Version written back as the initiative, on a host that keeps one canvas per Version.
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { projector } from "../project";
import type { PluginVersionStatus } from "../types/plugin.types";
import { OpscrEngine } from "./engine";
import { FakeCanvas } from "./fake-canvas.fixture";
import {
  InitiativeVersions,
  initiativeOfPath,
  isRootFile,
  type InitiativeBindings,
  type VersionsHost,
} from "./initiatives";
import type { SourceText } from "./patches";
import { emptyBinding, type BindingState } from "./sync";

const root = dirname(createRequire(import.meta.url).resolve("opscr/package.json"));
const git = (...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" });
const PREFIX = "examples/web-shop-product/";
const EXAMPLE: SourceText[] = git("ls-tree", "-r", "--name-only", "HEAD", PREFIX)
  .split("\n")
  .filter((p) => p.startsWith(PREFIX) && !p.endsWith("README.md"))
  .map((p) => ({ name: p.slice(PREFIX.length), text: git("show", `HEAD:${p}`) }));
const isManifest = (name: string) => name.endsWith(".opscr.yaml");
const CONFIG = "opscr.config.yaml";

/** One canvas for the base and one per Version, each Version starting as a copy of the base. */
class FakeVersionsHost implements VersionsHost {
  base = new FakeCanvas("d");
  versionsOf = new Map<
    string,
    { canvas: FakeCanvas; name: string; status: PluginVersionStatus | null }
  >();
  removed: string[] = [];
  getDiagram(_id: string, key: string) {
    return this.versionsOf.get(key)?.canvas.snapshot() ?? null;
  }
  applyChanges(
    changes: Parameters<VersionsHost["applyChanges"]>[0],
    _id: string,
    version: { key: string; name: string; status: PluginVersionStatus | null },
  ) {
    let entry = this.versionsOf.get(version.key);
    if (!entry) {
      const canvas = new FakeCanvas("d", 10_000);
      canvas.components = structuredClone(this.base.components);
      canvas.connections = structuredClone(this.base.connections);
      entry = { canvas, name: version.name, status: version.status };
      this.versionsOf.set(version.key, entry);
    }
    entry.name = version.name;
    entry.status = version.status;
    return entry.canvas.apply(changes);
  }
  versions() {
    return [...this.versionsOf].map(([key, v]) => ({ key, name: v.name, status: v.status }));
  }
  removeVersion(_id: string, key: string) {
    this.versionsOf.delete(key);
    this.removed.push(key);
  }
}

class Session {
  host = new FakeVersionsHost();
  files: SourceText[] = EXAMPLE.map((f) => ({ ...f }));
  rootBinding: BindingState = emptyBinding();
  initiativeBindings: InitiativeBindings = {};
  problems: string[][] = [];
  buffers = {
    get: () => this.files,
    set: (files: readonly SourceText[]) => {
      const next = [...this.files];
      for (const file of files) {
        const i = next.findIndex((f) => f.name === file.name);
        if (i >= 0) next[i] = { ...file };
        else next.push({ ...file });
      }
      this.files = next;
    },
    remove: (names: readonly string[]) => {
      this.files = this.files.filter((f) => !names.includes(f.name));
    },
  };
  rootEngine = new OpscrEngine({
    texts: {
      get: () => this.files.filter((f) => isRootFile(f.name)),
      set: (files) => this.buffers.set(files),
    },
    diagram: { get: () => this.host.base.snapshot(), apply: (c) => this.host.base.apply(c) },
    binding: { get: () => this.rootBinding, set: (b) => void (this.rootBinding = b) },
    project: projector,
    isManifest,
    configFile: CONFIG,
  });
  versions = new InitiativeVersions({
    host: this.host,
    buffers: this.buffers,
    targets: () => [{ diagramId: "d", baseBinding: () => this.rootBinding }],
    bindings: {
      get: () => this.initiativeBindings,
      set: (b) => void (this.initiativeBindings = b),
    },
    project: projector,
    isManifest,
    configFile: CONFIG,
    onEvent: (event) => void ("problem" in event && this.problems.push(event.problem)),
  });
  version = () => this.host.versionsOf.get("order-events")!.canvas;
  byLabel = (canvas: FakeCanvas, label: string) => canvas.components.find((c) => c.label === label);
  text = (name: string) => this.files.find((f) => f.name === name)?.text;
  async start() {
    await this.rootEngine.sync();
    await this.versions.sync();
  }
}

let s: Session;
beforeEach(() => {
  s = new Session();
});

describe("initiative paths", () => {
  it("tells initiative files from root files", () => {
    expect(initiativeOfPath("initiatives/order-events/x.opscr.yaml", "initiatives")).toBe(
      "order-events",
    );
    expect(initiativeOfPath("webshop.opscr.yaml", "initiatives")).toBeUndefined();
    expect(isRootFile("initiatives/order-events/x.opscr.yaml")).toBe(false);
  });
});

describe("InitiativeVersions", () => {
  it("draws each initiative as a Version: the root with the initiative applied", async () => {
    await s.start();
    expect(s.versions.initiatives()).toEqual([
      { name: "order-events", title: "Order events", status: "in-progress" },
    ]);
    const entry = s.host.versionsOf.get("order-events")!;
    expect(entry).toMatchObject({ name: "Order events", status: "in-progress" });
    const version = s.version();
    expect(s.byLabel(version, "order-events")).toBeDefined();
    expect(s.byLabel(version, "sessions")).toBeUndefined();
    expect(s.byLabel(version, "orders-api")?.description).toBe(
      "Takes and tracks orders, and publishes an event for each change",
    );
    // The base stays the AS-IS.
    expect(s.byLabel(s.host.base, "sessions")).toBeDefined();
    expect(s.byLabel(s.host.base, "order-events")).toBeUndefined();
    // Root elements keep their canvas ids in the Version.
    expect(s.byLabel(version, "storefront")?.id).toBe(s.byLabel(s.host.base, "storefront")?.id);
  });

  it("changes nothing the second time", async () => {
    await s.start();
    const before = s
      .version()
      .components.map((c) => `${c.id}:${c.label}`)
      .sort();
    await s.versions.sync();
    expect(
      s
        .version()
        .components.map((c) => `${c.id}:${c.label}`)
        .sort(),
    ).toEqual(before);
    // Drawing alone writes nothing: not the manifests, not the lock, not a sidecar.
    expect(s.files).toEqual(EXAMPLE);
  });

  it("writes a canvas edit in the Version to the initiative, never to the root", async () => {
    await s.start();
    const rootBefore = s.files.filter((f) => isRootFile(f.name)).map((f) => f.text);
    const storefront = s.byLabel(s.version(), "storefront")!;
    s.version().step(() => (storefront.description = "Shop pages, now with live order status"));
    await s.versions.canvasChanged("d", "order-events");
    expect(s.problems).toEqual([]);
    expect(s.text("initiatives/order-events/storefront.opscr.yaml")).toContain(
      'description: "Shop pages, now with live order status"',
    );
    expect(s.text("initiatives/order-events/initiative.lock")).toContain("Application/storefront");
    expect(s.files.filter((f) => isRootFile(f.name)).map((f) => f.text)).toEqual(rootBefore);
  });

  it("writes a retired stub for an element deleted in the Version", async () => {
    await s.start();
    const assets = s.byLabel(s.version(), "static-assets")!;
    s.version().step(() => s.version().remove([assets.id]));
    await s.versions.canvasChanged("d", "order-events");
    expect(s.problems).toEqual([]);
    expect(s.text("initiatives/order-events/retired.opscr.yaml")).toContain("name: static-assets");
  });

  it("starts the Version from the initiative's own boxes, and keeps a move inside it there", async () => {
    await s.start();
    expect(s.byLabel(s.version(), "orders-api")?.position).toEqual({ x: 420, y: 180 });
    expect(s.byLabel(s.host.base, "orders-api")?.position).toEqual({ x: 420, y: 200 });
    const rootLayout = s.text("opscr.layout.json");
    const storefront = s.byLabel(s.version(), "storefront")!;
    s.version().step(() => (storefront.position = { x: 100, y: 500 }));
    await s.versions.canvasChanged("d", "order-events");
    expect(s.text("opscr.layout.json")).toBe(rootLayout);
    expect(s.text("initiatives/order-events/opscr.layout.json")).toContain(
      '"Application/storefront": { "x": 100, "y": 500',
    );
  });

  it("moves every Version to its sidecar when the sidecar changed outside", async () => {
    await s.start();
    const storefront = s.byLabel(s.version(), "storefront")!;
    s.version().step(() => (storefront.position = { x: 999, y: 999 }));
    s.versions.reset();
    await s.versions.sidecarChanged();
    expect(s.byLabel(s.version(), "storefront")?.position).toEqual(
      s.byLabel(s.host.base, "storefront")?.position,
    );
  });

  it("draws the Version again when the root was drawn again with new canvas ids", async () => {
    await s.start();
    const before = s.files.map((f) => f.text);
    // The bound diagram showed a View and came back: every root element has a new canvas id.
    s.host.base.components = [];
    s.host.base.connections = [];
    s.rootBinding = emptyBinding();
    await s.rootEngine.sync();
    // The host's Version shows the base under it: the old ids are gone from it too.
    const version = s.version();
    const added = new Set(Object.values(s.initiativeBindings["d\u0000order-events"]!.state.ids));
    version.components = [
      ...structuredClone(s.host.base.components),
      ...version.components.filter((c) => added.has(c.id) && !s.byLabel(s.host.base, c.label)),
    ];
    version.connections = structuredClone(s.host.base.connections);
    await s.versions.sync();
    expect(s.problems).toEqual([]);
    expect(
      s.files.filter((f, i) => f.text !== before[i]).map((f) => `${f.name}\n${f.text}`),
    ).toEqual([]);
    expect(s.host.removed).toEqual(["order-events"]);
    const labels = s.version().components.map((c) => c.label);
    expect(labels.filter((l) => l === "orders-api")).toHaveLength(1);
    expect(labels).toContain("order-events");
    expect(labels).not.toContain("sessions");
    // An edit in it now goes to the initiative as usual.
    const storefront = s.byLabel(s.version(), "storefront")!;
    s.version().step(() => (storefront.description = "Shop pages, now with live order status"));
    await s.versions.canvasChanged("d", "order-events");
    expect(s.text("initiatives/order-events/retired.opscr.yaml")).toBe(
      before[s.files.findIndex((f) => f.name === "initiatives/order-events/retired.opscr.yaml")],
    );
  });

  it("places the initiative's new elements beside what they connect to, overlapping nothing", async () => {
    s.files = s.files.filter((f) => f.name !== "initiatives/order-events/opscr.layout.json");
    await s.start();
    const version = s.version();
    const at = (label: string) => {
      const c = s.byLabel(version, label)!;
      return {
        ...c.position!,
        width: c.size?.width ?? 180,
        height: c.size?.height ?? 80,
        parentId: c.parentId,
      };
    };
    const api = at("orders-api");
    const events = at("order-events");
    const worker = at("notifications-worker");
    // orders-api publishes to order-events, which triggers notifications-worker: left to right.
    expect(events).toMatchObject({ y: api.y, parentId: api.parentId });
    expect(events.x).toBeGreaterThan(api.x + api.width);
    expect(worker).toMatchObject({ y: events.y });
    expect(worker.x).toBeGreaterThan(events.x + events.width);
    const siblings = version.components
      .filter((c) => c.parentId === api.parentId)
      .map((c) => ({ label: c.label, ...at(c.label) }));
    for (const a of siblings)
      for (const b of siblings)
        if (a !== b)
          expect(
            a.x < b.x + b.width &&
              b.x < a.x + a.width &&
              a.y < b.y + b.height &&
              b.y < a.y + a.height,
            `${a.label} × ${b.label}`,
          ).toBe(false);
  });

  it("removes the Version of an initiative that is gone", async () => {
    await s.start();
    s.buffers.remove(s.files.filter((f) => f.name.startsWith("initiatives/")).map((f) => f.name));
    await s.versions.sync();
    expect(s.host.removed).toEqual(["order-events"]);
  });
});
