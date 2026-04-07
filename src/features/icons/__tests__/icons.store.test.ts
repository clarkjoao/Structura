import { describe, expect, it } from "vitest";
import type { IconDefinition } from "@/features/diagram";
import { useIconStore } from "../store/icons.store";

function sampleIcon(id: string): IconDefinition {
  return {
    id,
    name: `Icon ${id}`,
    createdAt: Date.now(),
    usageCount: 0,
    source: { kind: "svg", svgContent: "<svg></svg>" },
  };
}

describe("icons store", () => {
  it("addIcon stores an icon by id", () => {
    useIconStore.setState({ icons: {} });
    const icon = sampleIcon("i1");
    useIconStore.getState().addIcon(icon);
    expect(useIconStore.getState().icons.i1?.name).toBe("Icon i1");
  });

  it("removeIcon deletes the icon", () => {
    useIconStore.setState({ icons: { i1: sampleIcon("i1") } });
    useIconStore.getState().removeIcon("i1");
    expect(useIconStore.getState().icons.i1).toBeUndefined();
  });
});
