import { describe, expect, it } from "vitest";
import { exportOpscr } from "./export-opscr";
import { importOpscr } from "./import-opscr";
import type { DiagramSnapshot, PluginComponentSnapshot } from "./types/plugin.types";

const comp = (id: string, over: Partial<PluginComponentSnapshot>): PluginComponentSnapshot => ({
  id,
  type: "container",
  label: id,
  description: `${id} description`,
  parentId: null,
  position: null,
  size: null,
  tags: [],
  serviceId: null,
  cloudServiceId: null,
  technology: null,
  linkedDiagramId: null,
  ...over,
});

const diagram: DiagramSnapshot = {
  id: "d1",
  name: "Shop",
  description: null,
  components: [
    comp("p", { type: "panel", label: "Checkout" }),
    comp("api", { label: "Orders API", parentId: "p", technology: "aws" }),
    comp("db", { type: "system", label: "Billing DB", parentId: "p" }),
    comp("n", { type: "note", label: "A note" }),
  ],
  connections: [
    {
      id: "c1",
      sourceId: "api",
      targetId: "db",
      label: "charges",
      description: null,
      technology: null,
    },
  ],
};

describe("exportOpscr", () => {
  it("writes a manifest per drawable element, belongsTo and a calls edge", async () => {
    const { yaml, skipped } = await exportOpscr(diagram);
    expect(yaml).toContain("kind: Domain");
    expect(yaml).toContain("name: orders-api");
    expect(yaml).toContain("type: belongsTo");
    expect(yaml).toContain("type: calls");
    expect(skipped).toEqual(["A note"]);
    expect(yaml).toContain("# Not exported");
  });

  it("round-trips: the export imports back as the same elements", async () => {
    const { yaml } = await exportOpscr(diagram);
    const back = await importOpscr(yaml, {
      existingComponents: {},
      existingConnections: {},
      anchor: { x: 0, y: 0 },
    });
    // Names are slugified on export (kebab-case), imported back as-is
    expect(back.components.map((c) => c.name.toLowerCase())).toContain("orders-api");
    expect(back.components.length).toBeGreaterThanOrEqual(3);
    expect(back.connections.length).toBeGreaterThanOrEqual(1);
  });
});

describe("opscrExporter — a bound folder", () => {
  it("exports the open folder's files as a multi-file result", async () => {
    const { openSession } = await import("./session");
    const { opscrExporter } = await import("./export-opscr");
    const close = openSession({
      diagramId: "d1",
      folderName: "shop",
      manifests: () => [{ name: "a.opscr.yaml", text: "kind: Domain\n" }],
      config: () => ({ name: "opscr.config.yaml", text: "x: 1\n" }),
      apply: async () => ({ componentIds: [], connectionIds: [] }),
    });
    const out = await opscrExporter.export(diagram);
    close();
    expect(out).toEqual([
      { path: "a.opscr.yaml", content: "kind: Domain\n" },
      { path: "opscr.config.yaml", content: "x: 1\n" },
    ]);
    expect(typeof (await opscrExporter.export(diagram))).toBe("string");
  });
});
