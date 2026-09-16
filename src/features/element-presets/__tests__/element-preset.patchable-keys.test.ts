import { describe, expect, it } from "vitest";
import "@/features/elements/bootstrap";
import { allElements, getElement } from "@/features/elements/element.registry";
import type { Component } from "@/features/diagram";
import {
  buildComponentPatchFromPreset,
  createPresetDataFromNode,
} from "../utils/element-preset.utils";
import type { ElementPreset } from "../types";

/**
 * A preset round-trip must not drop the fields that make its element render.
 *
 * `element-presets` used to carry a hand-written allowlist that had drifted
 * from what the descriptors declare, so saving a preset of an `svg` node lost
 * `svgContent` and a `process-node` lost `flowShape` — both required by their
 * component type. The list is now derived from `model.patchableKeys`, which is
 * what this locks.
 */

function roundTrip(component: Component): Record<string, unknown> {
  const { baseType, data } = createPresetDataFromNode({ type: component.type }, component);
  const preset: ElementPreset = {
    id: "preset-1",
    name: "Preset",
    baseType,
    data,
    templateVersion: 1,
    createdAt: 0,
    updatedAt: 0,
  };
  return buildComponentPatchFromPreset(preset, false) as unknown as Record<string, unknown>;
}

describe("a preset survives the fields its element declares", () => {
  it("keeps svgContent on an svg preset", () => {
    const patch = roundTrip({
      id: "el-1",
      name: "Logo",
      description: "",
      parentId: null,
      type: "svg",
      svgContent: "<svg><rect /></svg>",
    } as Component);

    expect(patch.svgContent).toBe("<svg><rect /></svg>");
  });

  it("keeps flowShape and nodeColor on a process-node preset", () => {
    const patch = roundTrip({
      id: "el-2",
      name: "Step",
      description: "",
      parentId: null,
      type: "process-node",
      flowShape: "decision",
      nodeColor: "#ff0000",
    } as unknown as Component);

    expect(patch.flowShape).toBe("decision");
    expect(patch.nodeColor).toBe("#ff0000");
  });

  it("keeps panelColorDark on a note preset", () => {
    const patch = roundTrip({
      id: "el-3",
      name: "Note",
      description: "",
      parentId: null,
      type: "note",
      panelColor: "60 100% 90%",
      panelColorDark: "60 30% 20%",
    } as Component);

    expect(patch.panelColorDark).toBe("60 30% 20%");
  });

  it("keeps customColor on a cloud preset", () => {
    const patch = roundTrip({
      id: "el-4",
      name: "Lambda",
      description: "",
      parentId: null,
      type: "aws-compute",
      cloudServiceId: "lambda",
      customColor: "#123456",
    } as Component);

    expect(patch.cloudServiceId).toBe("lambda");
    expect(patch.customColor).toBe("#123456");
  });

  it("keeps the external-element links", () => {
    const patch = roundTrip({
      id: "el-5",
      name: "Other",
      description: "",
      parentId: null,
      type: "external-element",
      referenceDiagramId: "d2",
      linkedElementId: "el-x",
      linkedElementName: "Payments",
      linkedDiagramName: "Billing",
    } as unknown as Component);

    expect(patch.linkedElementId).toBe("el-x");
    expect(patch.linkedElementName).toBe("Payments");
    expect(patch.linkedDiagramName).toBe("Billing");
  });

  /**
   * The regression guard that does not need a new case per element: whatever a
   * descriptor declares patchable, a preset of that element must carry.
   */
  it("covers every registered element's declared keys", () => {
    const dropped: string[] = [];

    for (const element of allElements()) {
      const declared = element.model.patchableKeys;
      if (declared.length === 0) continue;

      const component = {
        id: "el-x",
        name: "Name",
        description: "",
        parentId: null,
        type: element.id,
        ...Object.fromEntries(declared.map((key) => [key, `value-${key}`])),
      } as unknown as Component;

      const patch = roundTrip(component);
      for (const key of declared) {
        if (patch[key] !== `value-${key}`) dropped.push(`${element.id}.${key}`);
      }
    }

    expect(dropped, `preset round-trip dropped declared fields: ${dropped.join(", ")}`).toEqual([]);
  });
});

describe("the derived allowlist still rejects what is not a component field", () => {
  it("drops React Flow UI-only node data", () => {
    const { data } = createPresetDataFromNode({
      type: "note",
      data: {
        panelColor: "60 100% 90%",
        isSelected: true,
        onDrillDown: () => {},
        incomingCount: 3,
        somethingInvented: "nope",
      },
    });

    expect(data.panelColor).toBe("60 100% 90%");
    expect(data.isSelected).toBeUndefined();
    expect(data.onDrillDown).toBeUndefined();
    expect(data.incomingCount).toBeUndefined();
    expect(data.somethingInvented).toBeUndefined();
  });

  it("does not let one element's fields leak into another's preset", () => {
    // `svgContent` belongs to `svg`; a note preset must not carry it.
    expect(getElement("note")!.model.patchableKeys).not.toContain("svgContent");

    const { data } = createPresetDataFromNode({
      type: "note",
      data: { panelColor: "60 100% 90%", svgContent: "<svg />" },
    });

    expect(data.panelColor).toBe("60 100% 90%");
    expect(data.svgContent).toBeUndefined();
  });
});
