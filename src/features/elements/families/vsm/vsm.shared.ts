import { createElement } from "react";
import type { LucideIcon } from "lucide-react";
import type { NodeBuildContext } from "@/features/canvas/nodes/node-types/types";
import { SINGLE_PAIR_HANDLES } from "@/features/canvas/nodes/node-types/handle-spec";
import { flowExportColours } from "@/features/canvas/nodes/ProcessNode/flowExportColor";
import VsmPanel from "@/features/canvas/panels/ElementPanel/VsmPanel";
import type { Component, SkinParts } from "@/features/diagram/model/component.types";
import type {
  ElementCanvasSlice,
  ElementComponentBase,
  ElementDescriptor,
} from "../../element.types";

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

/**
 * Everything a plain VSM element declares, from the few things that differ.
 * The supplier/customer and the process box predate it and spell theirs out;
 * the rest are this shape exactly.
 */
export interface VsmElementSpec<C extends Component & SkinParts> {
  id: ElementDescriptor["id"];
  node: ElementCanvasSlice["component"];
  guard: (comp: Component) => comp is C;
  /** A new, empty component of this type. */
  create: (base: ElementComponentBase) => C;
  size: { width: number; height: number };
  icon: LucideIcon;
  searchKeys: readonly string[];
  defaultAccent: string;
  /** Fields beyond the skin that the node renders and presets may copy. */
  fields: ReadonlyArray<keyof C & string>;
  /**
   * Whether the user can draw edges to and from it. A push arrow, a kaizen
   * burst and the timeline cannot: they annotate the stream, they are not in it.
   */
  connectable: boolean;
  /**
   * The draw.io shape style, confirmed against draw.io's sources — a function
   * when it depends on the component (the timeline's plateaus).
   */
  shapeStyle: string | ((comp: C, width: number) => string);
  exportLabel: (comp: C) => string;
}

export function defineVsmElement<C extends Component & SkinParts>(
  spec: VsmElementSpec<C>,
): ElementDescriptor {
  const { id, guard, size } = spec;
  return {
    id,
    family: VSM_FAMILY_ID,
    labelKey: `elements.${id}.label`,
    descriptionKey: `elements.${id}.description`,

    model: {
      createComponent: (base) => spec.create(base),
      defaultSize: size,
      patchableKeys: [...spec.fields, ...skinPatchableKeys],
    },

    canvas: {
      rfType: id,
      component: spec.node,
      handles: SINGLE_PAIR_HANDLES,
      role: "custom-shape",
      zIndex: 1,
      connectable: spec.connectable,
      canHaveParent: true,
      canBeParent: false,
      canBeConnectionSource: true,
      derivesSize: false,

      buildData: (comp, ctx) => {
        if (!guard(comp)) return {};
        const fields: Record<string, unknown> = {};
        for (const field of spec.fields) fields[field] = comp[field];
        return { ...skinBuildData(comp, ctx), ...fields };
      },

      buildStyle: (comp, ctx) => {
        const layout = ctx.resolvedNodeLayouts[comp.id];
        return { width: layout?.width ?? size.width, height: layout?.height ?? size.height };
      },
    },

    palette: {
      categoryId: VSM_CATEGORY_ID,
      icon: { kind: "lucide", icon: spec.icon },
      accent: { kind: "neutral" },
      searchKeys: ["vsm", ...spec.searchKeys],
    },

    inspector: { panel: (props) => createElement(VsmPanel, props) },

    skin: { defaultAccent: spec.defaultAccent },

    export: {
      drawio: {
        toExportNode: (comp, base) => {
          if (!guard(comp)) {
            throw new Error(`[elements] ${id} export received a ${comp.type} component.`);
          }
          return {
            ...base,
            kind: "stencil",
            name: comp.name,
            shapeStyle:
              typeof spec.shapeStyle === "function"
                ? spec.shapeStyle(comp, base.width)
                : spec.shapeStyle,
            label: spec.exportLabel(comp),
            ...flowExportColours(comp, spec.defaultAccent),
          };
        },
      },
    },
  };
}
