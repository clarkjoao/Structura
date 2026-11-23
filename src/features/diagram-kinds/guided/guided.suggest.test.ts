import { describe, expect, it } from "vitest";
import { kindContextFor } from "../context";
import { registerBuiltInDiagramKinds } from "../bootstrap";
import { guidedHarness } from "./guided.harness";
import { buildOutline } from "./guided.outline.build";
import { parseOutline } from "./guided.outline.parse";
import { guidedSuggest } from "./guided.suggest";

registerBuiltInDiagramKinds();

function journey() {
  const h = guidedHarness();
  const built = buildOutline(
    h.diagram(),
    parseOutline("## Descobrir\nUser: Escolhe produto\nEscreve review\n## Comprar\nSystem: Cobra"),
    [h.startId],
    kindContextFor(h.diagram()),
  );
  if (!("edit" in built)) throw new Error("build");
  h.apply(built.edit);
  return h;
}

describe("suggestions while typing", () => {
  it("offers steps after @, case-insensitively, replacing after the @", () => {
    const h = journey();
    expect(guidedSuggest(h.diagram(), "  não -> @esc")).toEqual({
      from: 10,
      items: [
        { label: "Escolhe produto", insert: "Escolhe produto" },
        { label: "Escreve review", insert: "Escreve review" },
      ],
    });
  });

  it("offers phases after ## and lanes at a line's start, with their colon", () => {
    const h = journey();
    expect(guidedSuggest(h.diagram(), "## Co")!.items.map((i) => i.label)).toEqual(["Comprar"]);
    expect(guidedSuggest(h.diagram(), "  Sy")).toEqual({
      from: 2,
      items: [{ label: "System", insert: "System: " }],
    });
  });

  it("offers nothing mid-name, after a marker, or for an exact match", () => {
    const h = journey();
    expect(guidedSuggest(h.diagram(), "User: Esc")).toBeNull();
    expect(guidedSuggest(h.diagram(), "? Sy")).toBeNull();
    expect(guidedSuggest(h.diagram(), "")).toBeNull();
    expect(guidedSuggest(h.diagram(), "System")).toBeNull();
  });
});
