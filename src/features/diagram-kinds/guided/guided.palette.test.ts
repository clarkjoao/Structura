import { describe, expect, it } from "vitest";
import { buildCanvasCatalogIndex } from "@/features/canvas/catalog/canvasCatalogIndex";
import { registerBuiltInDiagramKinds } from "../bootstrap";
import { kindOffersElement } from "../palette";
import { kindCommandContextFor } from "../context";
import { guidedKind } from "./guided.kind";
import { guidedHarness } from "./guided.harness";

registerBuiltInDiagramKinds();

function offeredIndex(kindMode?: "freehand") {
  const diagram = { kind: "guided", ...(kindMode && { kindMode }) };
  return buildCanvasCatalogIndex(
    [],
    [],
    (entry) =>
      entry.insert.kind === "element" &&
      kindOffersElement(diagram, {
        type: entry.insert.type,
        ...(entry.insert.createOptions.flowShape && {
          flowShape: entry.insert.createOptions.flowShape,
        }),
      }),
  );
}

describe("guided palette", () => {
  it("offers the journey steps and annotations, and no architecture element", () => {
    const entries = offeredIndex().entries;
    const flowShapes = entries
      .filter((e) => e.insert.kind === "element" && e.insert.type === "process-node")
      .map((e) => (e.insert.kind === "element" ? e.insert.createOptions.flowShape : undefined))
      .sort();
    expect(flowShapes).toEqual(
      [
        "cylinder",
        "diamond",
        "document",
        "end",
        "event",
        "rectangle",
        "start",
        "subroutine",
      ].sort(),
    );
    const types = new Set(
      entries.map((e) => (e.insert.kind === "element" ? e.insert.type : e.insert.kind)),
    );
    expect([...types].some((type) => /aws|gcp|azure|system|container/.test(type))).toBe(false);
    expect(entries.some((e) => /lambda/i.test(e.label))).toBe(false);
  });

  it("offers everything in freehand mode", () => {
    expect(kindOffersElement({ kind: "guided", kindMode: "freehand" }, { type: "system" })).toBe(
      true,
    );
    expect(kindOffersElement({}, { type: "aws-compute" })).toBe(true);
    expect(kindOffersElement({ kind: "guided" }, { type: "aws-compute" })).toBe(false);
  });

  it("inserts into the selected lane, after the selected step when there is one", () => {
    const h = guidedHarness();
    const run = (selected: string[], flowShape: "document" | "cylinder") => {
      const outcome = guidedKind.insert!(kindCommandContextFor(h.diagram(), selected), {
        type: "process-node",
        flowShape,
      });
      if ("refused" in outcome) throw new Error("refused");
      const result = h.apply(outcome.edit);
      return result.idsByKey[outcome.select!]!;
    };
    const doc = run([h.startId], "document");
    expect(h.reading().incoming.get(doc)![0]!.sourceId).toBe(h.startId);
    const store = run([h.laneIds[1]!], "cylinder");
    expect(h.reading().laneOf.get(store)).toBe(h.laneIds[1]);
    expect(h.reading().incoming.get(store)).toBeUndefined();
  });
});
