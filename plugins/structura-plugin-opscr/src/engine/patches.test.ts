import { SAMPLE_FILES } from "../test-sample";
import { compileSources } from "opscr/core";
import { describe, expect, it } from "vitest";
import {
  addEdge,
  countEdges,
  edgeSource,
  hasManifest,
  nameAt,
  removeEdge,
  removeElements,
  renameElement,
  restoreElement,
  setDescription,
  setEdgeType,
  type SourceText,
} from "./patches";
import { parseDocuments } from "./yaml-text";

const SAMPLE: SourceText[] = Object.keys(SAMPLE_FILES)
  .filter((f) => f.endsWith(".opscr.yaml"))
  .sort()
  .map((name) => ({ name, text: SAMPLE_FILES[name]! }));
const CONFIG = {
  path: "opscr.config.yaml",
  content: SAMPLE_FILES["opscr.config.yaml"]!,
};

const text = (files: SourceText[], name: string) => files.find((f) => f.name === name)!.text;
/** Lines that differ between two texts, as `-old` / `+new`. */
function changedLines(before: string, after: string): string[] {
  const a = before.split("\n");
  const b = after.split("\n");
  const out: string[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) out.push(`-${a[i] ?? ""}`, `+${b[i] ?? ""}`);
  }
  return out;
}
async function errors(files: SourceText[]) {
  const { result } = await compileSources({
    files: files.map((f) => ({ path: f.name, content: f.text })),
    config: CONFIG,
  });
  return result.diagnostics.filter((d) => d.severity === "error").map((d) => d.message);
}

const DB = { kind: "Database", name: "orders-db" };

describe("renameElement", () => {
  it("renames the manifest and every edge end, and nothing else", async () => {
    const files = renameElement(SAMPLE, DB, "order-store")!;
    const commerce = changedLines(
      text(SAMPLE, "commerce.opscr.yaml"),
      text(files, "commerce.opscr.yaml"),
    );
    expect(commerce).toEqual(["-  name: orders-db", "+  name: order-store"]);
    const relationships = changedLines(
      text(SAMPLE, "relationships.opscr.yaml"),
      text(files, "relationships.opscr.yaml"),
    );
    expect(relationships.length).toBeGreaterThan(0);
    expect(
      relationships.filter((l) => l.startsWith("+")).every((l) => l.includes("id: order-store")),
    ).toBe(true);
    expect(text(files, "relationships.opscr.yaml")).not.toContain("orders-db");
    expect(await errors(files)).toEqual(await errors(SAMPLE));
  });

  it("refuses a name the same Kind already uses", () => {
    expect(renameElement(SAMPLE, DB, "catalog-db")).toBeNull();
  });

  it("keeps quoting: a quoted name stays quoted", () => {
    const files = [
      { name: "a.opscr.yaml", text: 'kind: Cache\nmetadata:\n  name: "c"\nspec: {}\n' },
    ];
    expect(renameElement(files, { kind: "Cache", name: "c" }, "d")![0]!.text).toContain(
      'name: "d"',
    );
  });
});

describe("setDescription", () => {
  it("replaces the description in place, keeping its quotes", () => {
    const files = setDescription(SAMPLE, DB, "Orders, with history")!;
    expect(
      changedLines(text(SAMPLE, "commerce.opscr.yaml"), text(files, "commerce.opscr.yaml")),
    ).toEqual([
      '-  description: "Orders and their status history (stream enabled)"',
      '+  description: "Orders, with history"',
    ]);
  });

  it("adds a description line to a spec that has none", () => {
    const files = [
      {
        name: "a.opscr.yaml",
        text: "kind: Cache\nmetadata:\n  name: c\nspec:\n  provider: S3\n# end\n",
      },
    ];
    expect(setDescription(files, { kind: "Cache", name: "c" }, "Carts")![0]!.text).toBe(
      "kind: Cache\nmetadata:\n  name: c\nspec:\n  provider: S3\n  description: Carts\n# end\n",
    );
  });
});

describe("removeElements", () => {
  it("removes adjacent manifests without eating the next one", () => {
    const m = (n: string) => `kind: Database\nmetadata:\n  name: ${n}\n`;
    const text = m("a") + "--- # second\n" + m("b") + "---\n" + m("c");
    const result = removeElements(
      [{ name: "x.opscr.yaml", text }],
      [
        { kind: "Database", name: "a" },
        { kind: "Database", name: "b" },
      ],
    );
    expect(result!.files[0]!.text).toBe(m("c"));
  });

  it("removes the manifest and the edges naming it, and the files still compile", async () => {
    const result = removeElements(SAMPLE, [{ kind: "Cache", name: "cart-cache" }])!;
    expect(hasManifest(result.files, { kind: "Cache", name: "cart-cache" })).toBe(false);
    expect(result.files.map((f) => f.text).join("\n")).not.toContain("cart-cache");
    const removed = result.removed.get("Cache/cart-cache")!;
    expect(removed.file).toBe("commerce.opscr.yaml");
    expect(removed.source).toContain("name: cart-cache");
    expect(removed.edges.length).toBeGreaterThan(0);
    expect(await errors(result.files)).toEqual(await errors(SAMPLE));
  });

  it("restoring puts the manifest and its edges back", async () => {
    const result = removeElements(SAMPLE, [{ kind: "Cache", name: "cart-cache" }])!;
    const removed = result.removed.get("Cache/cart-cache")!;
    let files = restoreElement(result.files, removed);
    for (const edge of removed.edges) files = addEdge(files, edge, edge.relationship)!;
    expect(hasManifest(files, { kind: "Cache", name: "cart-cache" })).toBe(true);
    for (const edge of removed.edges) expect(countEdges(files, edge)).toBe(1);
    expect(await errors(files)).toEqual(await errors(SAMPLE));
  });

  it("removes a Relationship whose every edge goes", () => {
    const files = [
      {
        name: "a.opscr.yaml",
        text: [
          "kind: Cache\nmetadata:\n  name: c\nspec: {}",
          "kind: Relationship\nmetadata:\n  name: r\nspec:\n  edges:\n    - from: { kind: Cache, id: c }\n      to: { kind: Cache, id: d }\n      type: calls",
          "kind: Cache\nmetadata:\n  name: d\nspec: {}\n",
        ].join("\n---\n"),
      },
    ];
    const result = removeElements(files, [{ kind: "Cache", name: "c" }])!;
    expect(result.files[0]!.text).toBe("kind: Cache\nmetadata:\n  name: d\nspec: {}\n");
    expect(parseDocuments(result.files[0]!.text)).toHaveLength(1);
  });
});

describe("edges", () => {
  const tracker = { kind: "Application", name: "order-tracker" };
  const catalogDb = { kind: "Database", name: "catalog-db" };

  it("adds an edge to the Relationship holding the source's edges, in its style", () => {
    const files = addEdge(SAMPLE, { from: tracker, to: catalogDb, type: "reads" })!;
    const diff = changedLines(
      text(SAMPLE, "relationships.opscr.yaml"),
      text(files, "relationships.opscr.yaml"),
    );
    expect(diff.filter((l) => l.startsWith("+")).join("\n")).toContain(
      "    - from: { kind: Application, id: order-tracker }",
    );
    expect(countEdges(files, { from: tracker, to: catalogDb, type: "reads" })).toBe(1);
    const added = edgeSource(files, { from: tracker, to: catalogDb, type: "reads", n: 0 })!;
    expect(added.relationship).toBe("orders-relationships");
  });

  it("creates a Relationship when nothing names the source", () => {
    const files = [{ name: "a.opscr.yaml", text: "kind: Cache\nmetadata:\n  name: c\nspec: {}\n" }];
    const out = addEdge(files, {
      from: { kind: "Cache", name: "c" },
      to: { kind: "Cache", name: "c" },
      type: "calls",
    })!;
    expect(out[0]!.text).toContain(
      "---\napiVersion: opscr.dev/v1\nkind: Relationship\nmetadata:\n  name: c-relationships",
    );
    expect(
      countEdges(out, {
        from: { kind: "Cache", name: "c" },
        to: { kind: "Cache", name: "c" },
        type: "calls",
      }),
    ).toBe(1);
  });

  it("removes and retypes an edge, by ends, type and index", async () => {
    const match = {
      from: { kind: "Channel", name: "store-web" },
      to: { kind: "APIGateway", name: "public-api" },
      type: "calls",
      n: 0,
    };
    const removed = removeEdge(SAMPLE, match)!;
    expect(countEdges(removed.files, match)).toBe(0);
    expect(
      changedLines(
        text(SAMPLE, "relationships.opscr.yaml"),
        text(removed.files, "relationships.opscr.yaml"),
      ).length,
    ).toBeGreaterThan(0);
    const { files: retyped, n } = setEdgeType(SAMPLE, match, "relatedTo")!;
    expect(n).toBe(0);
    expect(countEdges(retyped, { ...match, type: "relatedTo" })).toBe(1);
    expect(
      changedLines(
        text(SAMPLE, "relationships.opscr.yaml"),
        text(retyped, "relationships.opscr.yaml"),
      ),
    ).toEqual(["-      type: calls", "+      type: relatedTo"]);
    expect(await errors(removed.files)).toEqual(await errors(SAMPLE));
  });
});

describe("setEdgeType", () => {
  it("gives the edge's index among its new type by its place in the text", () => {
    const files = [
      {
        name: "r.opscr.yaml",
        text: [
          "kind: Relationship",
          "metadata:",
          "  name: r",
          "spec:",
          "  edges:",
          "    - from: { kind: A, id: a }",
          "      to: { kind: B, id: b }",
          "      type: calls",
          "    - from: { kind: A, id: a }",
          "      to: { kind: B, id: b }",
          "      type: reads",
          "",
        ].join("\n"),
      },
    ];
    const from = { kind: "A", name: "a" };
    const to = { kind: "B", name: "b" };
    expect(setEdgeType(files, { from, to, type: "calls", n: 0 }, "reads")?.n).toBe(0);
  });
});

describe("nameAt", () => {
  const commerce = text(SAMPLE, "commerce.opscr.yaml");
  const relationships = text(SAMPLE, "relationships.opscr.yaml");

  it("finds a manifest's name, cursor inside or right after it", () => {
    const start = commerce.indexOf("name: orders-db") + "name: ".length;
    for (const offset of [start, start + 3, start + "orders-db".length]) {
      expect(nameAt(SAMPLE, "commerce.opscr.yaml", offset)).toEqual({
        ref: DB,
        start,
        end: start + "orders-db".length,
      });
    }
  });

  it("finds an edge end's id, with the end's kind", () => {
    const at = relationships.indexOf("id: orders-db") + "id: ".length + 2;
    expect(nameAt(SAMPLE, "relationships.opscr.yaml", at)?.ref).toEqual(DB);
  });

  it("finds nothing elsewhere", () => {
    expect(
      nameAt(SAMPLE, "commerce.opscr.yaml", commerce.indexOf("provider: DynamoDB") + 3),
    ).toBeNull();
    expect(nameAt(SAMPLE, "missing.opscr.yaml", 0)).toBeNull();
  });
});
