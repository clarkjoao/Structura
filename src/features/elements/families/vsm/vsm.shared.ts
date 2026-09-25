import type { NodeBuildContext } from "@/features/canvas/nodes/node-types/types";
import type { Component, SkinParts } from "@/features/diagram/model/component.types";

/**
 * The Value Stream Mapping family. Registered through `registerElement`, so it
 * gets its own picker tab and its own heading in the LLM catalog from the
 * registry alone (`elements.families.vsm.label`).
 */
export const VSM_FAMILY_ID = "vsm";
export const VSM_CATEGORY_ID = "vsm";

/** The skin's parts, copyable by presets like any other field. */
export const skinPatchableKeys = ["customColor", "fill", "stroke"] as const;

/** What every skinned VSM node receives, beyond its own fields. */
export function skinBuildData(comp: Component & SkinParts, ctx: NodeBuildContext) {
  return {
    elementId: comp.id,
    name: comp.name,
    description: comp.description,
    customColor: comp.customColor,
    fill: comp.fill,
    stroke: comp.stroke,
    isSelected: ctx.selectedNodeId === comp.id,
  };
}
