import { describe, expect, it } from "vitest";
import { connectionKeys } from "./importer-graph";
import { SourceIndex, type LocatedManifestInput } from "./source-index";
import { buildTechnicalView } from "./technical-view";

const at = (
  file: string,
  line: number,
  kind: string,
  name: string,
  spec: Record<string, unknown> = {},
  edgeLines: Array<[number, number]> = [],
): LocatedManifestInput => ({
  kind,
  metadata: { name },
  spec,
  sourceFile: file,
  line,
  edgeLines: new Map(edgeLines),
});
const end = (kind: string, id: string) => ({ kind, id });

// apps.opscr.yaml: a panel, two apps and a business Kind that is not drawn.
// rel.opscr.yaml: a belongsTo, a call, and an edge to a missing manifest.
const manifests = [
  at("apps", 1, "ApplicationService", "orders"),
  at("apps", 6, "Application", "api"),
  at("apps", 11, "Application", "worker"),
  at("apps", 16, "BusinessCapability", "selling"),
  at(
    "rel",
    1,
    "Relationship",
    "r",
    {
      edges: [
        {
          from: end("Application", "api"),
          to: end("ApplicationService", "orders"),
          type: "belongsTo",
        },
        { from: end("Application", "api"), to: end("Application", "worker"), type: "calls" },
        { from: end("Application", "api"), to: end("Application", "gone"), type: "calls" },
      ],
    },
    [
      [0, 6],
      [1, 9],
      [2, 12],
    ],
  ),
];
const view = buildTechnicalView({ manifests });
const index = new SourceIndex(manifests, view);
const [call] = connectionKeys([
  { source: "Application/api", target: "Application/worker", label: "calls" },
]);

describe("SourceIndex", () => {
  it("locates a component at its manifest and a connection at its edge", () => {
    expect(index.locate({ kind: "component", key: "Application/worker" })).toEqual({
      file: "apps",
      line: 11,
    });
    expect(index.locate({ kind: "connection", key: call! })).toEqual({ file: "rel", line: 9 });
    expect(index.locate({ kind: "component", key: "Application/nope" })).toBeUndefined();
  });

  it("does not take a belongsTo for where its child is written, in either file order", () => {
    for (const each of [index, new SourceIndex([...manifests].reverse(), view)]) {
      expect(each.locate({ kind: "component", key: "Application/api" })).toEqual({
        file: "apps",
        line: 6,
      });
    }
  });

  it("finds the element a line writes, down to the next manifest or edge", () => {
    expect(index.elementAt("apps", 1)).toEqual({
      kind: "component",
      key: "ApplicationService/orders",
    });
    expect(index.elementAt("apps", 8)).toEqual({ kind: "component", key: "Application/api" });
    expect(index.elementAt("rel", 10)).toEqual({ kind: "connection", key: call });
    // A belongsTo is shown as the child it places.
    expect(index.elementAt("rel", 7)).toEqual({ kind: "component", key: "Application/api" });
  });

  it("finds nothing where nothing is drawn", () => {
    expect(index.elementAt("apps", 18)).toBeNull(); // a Kind the view omits
    expect(index.elementAt("rel", 3)).toBeNull(); // the Relationship's own header
    expect(index.elementAt("rel", 13)).toBeNull(); // an edge to a missing manifest
    expect(index.elementAt("other", 1)).toBeNull();
  });

  it("locates every manifest and edge, drawn or not", () => {
    expect(index.locateWritten("BusinessCapability/selling")).toEqual({ file: "apps", line: 16 });
    expect(index.locateWritten("r#2")).toEqual({ file: "rel", line: 12 });
    expect(index.locateWritten("r#9")).toBeUndefined();
  });
});
