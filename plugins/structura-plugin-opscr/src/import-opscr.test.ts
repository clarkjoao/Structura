import { SAMPLE_FILES } from "./test-sample";
import { beforeAll, describe, expect, it } from "vitest";
import { canImportOpscr, importOpscr } from "./import-opscr";
import type { ImportResult, PluginComponentInput } from "./types/plugin.types";

/** The sample's manifests as one multi-document file — how a workspace is imported today. */
const SAMPLE = Object.keys(SAMPLE_FILES)
  .filter((f) => f.endsWith(".opscr.yaml"))
  .sort()
  .map((f) => SAMPLE_FILES[f]!)
  .join("\n---\n");

const anchor = { x: 1000, y: 500 };

describe("canImportOpscr", () => {
  it("takes opscr files and YAML that declares an opscr apiVersion", () => {
    expect(canImportOpscr("shop.opscr.yaml", "")).toBe(true);
    expect(canImportOpscr("shop.opscr.yml", "")).toBe(true);
    expect(canImportOpscr("all.yaml", "apiVersion: opscr.dev/v1\nkind: Domain")).toBe(true);
  });

  it("leaves unrelated YAML alone", () => {
    expect(canImportOpscr("docker-compose.yml", "services:\n  web:\n    image: nginx")).toBe(false);
  });
});

describe("importOpscr — the sample as one file", () => {
  let result: ImportResult;
  let byKey: Map<string, PluginComponentInput>;
  beforeAll(async () => {
    result = await importOpscr(SAMPLE, { existingComponents: {}, existingConnections: {}, anchor });
    byKey = new Map(result.components.map((c) => [c.key, c]));
  });
  const childrenOf = (key: string) =>
    result.components
      .filter((c) => c.parentKey === key)
      .map((c) => c.key)
      .sort();

  it("draws domains and bounded contexts as nested panels sized for their children", () => {
    expect(byKey.get("Domain/commerce")).toMatchObject({ type: "panel" });
    expect(childrenOf("Domain/commerce")).toEqual([
      "ApplicationService/catalog",
      "ApplicationService/orders",
    ]);
    expect(childrenOf("ApplicationService/orders")).toEqual([
      "Application/order-tracker",
      "Application/orders-api",
    ]);
    const orders = byKey.get("ApplicationService/orders")!;
    for (const key of childrenOf("ApplicationService/orders")) {
      const child = byKey.get(key)!;
      expect(child.x).toBeGreaterThanOrEqual(0);
      expect(child.x).toBeLessThan(orders.width!);
      expect(child.y).toBeLessThan(orders.height!);
    }
  });

  it("imports technical Kinds as their catalog components", () => {
    expect(byKey.get("Database/orders-db")).toMatchObject({
      type: "aws-database",
      cloudServiceId: "dynamodb",
      technology: "DynamoDB",
    });
  });

  it("connects drawn elements, labelled with the edge type", () => {
    expect(result.connections).toContainEqual({
      source: "Application/orders-api",
      target: "Database/orders-db",
      label: "writes",
    });
    const keys = new Set(byKey.keys());
    for (const c of result.connections) {
      expect(keys.has(c.source) && keys.has(c.target)).toBe(true);
    }
  });

  it("places roots at the anchor without overlapping", () => {
    const roots = result.components.filter((c) => c.parentKey === undefined);
    const box = (c: PluginComponentInput) => ({
      x: c.x,
      y: c.y,
      w: c.width ?? 180,
      h: c.height ?? 80,
    });
    for (const root of roots) {
      expect(root.x).toBeGreaterThanOrEqual(anchor.x);
      expect(root.y).toBeGreaterThanOrEqual(anchor.y);
    }
    for (let i = 0; i < roots.length; i++) {
      for (let j = i + 1; j < roots.length; j++) {
        const a = box(roots[i]!);
        const b = box(roots[j]!);
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap, `${roots[i]!.key} overlaps ${roots[j]!.key}`).toBe(false);
      }
    }
  });

  it("reports what the technical view leaves out", () => {
    expect(result.warnings.some((w) => w.startsWith("Not drawn in the technical view"))).toBe(true);
    expect(result.warnings.some((w) => w.startsWith("Edges not drawn"))).toBe(true);
    expect(result.warnings.some((w) => w.startsWith("opscr:"))).toBe(false);
  });
});

describe("importOpscr — bad input", () => {
  const ctx = { existingComponents: {}, existingConnections: {}, anchor };

  it("imports the valid elements and reports an invalid manifest", async () => {
    const result = await importOpscr(
      `apiVersion: opscr.dev/v1
kind: Database
metadata: { name: good }
spec: { provider: DynamoDB, description: ok }
---
apiVersion: opscr.dev/v1
kind: Database
metadata: { name: bad }
spec: { provider: DynamoDB, description: ok, inventedField: 1 }
`,
      ctx,
    );
    expect(result.components.map((c) => c.key)).toContain("Database/good");
    expect(result.warnings.some((w) => w.includes("inventedField"))).toBe(true);
  });

  it("creates nothing for YAML that does not parse, and says why", async () => {
    const result = await importOpscr("apiVersion: opscr.dev/v1\nkind: [", ctx);
    expect(result.components).toEqual([]);
    expect(result.warnings.some((w) => w.startsWith("opscr:"))).toBe(true);
  });
});
