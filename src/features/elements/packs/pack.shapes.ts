import { Shapes } from "lucide-react";
import ShapeNode from "@/features/canvas/nodes/ShapeNode";
import { SHAPE_DEFAULT_SIZE } from "@/features/canvas/nodes/ShapeNode/shapeSize";
import { SINGLE_PAIR_HANDLES } from "@/features/canvas/nodes/node-types/handle-spec";
import { laneAccentFor } from "@/features/canvas/nodes/laneAccent";
import { isPluginComponentType } from "@/features/diagram/model/component-type-constants";
import type { Component } from "@/features/diagram/model/component.types";
import type { ElementDescriptor, ElementTypeId } from "../element.types";
import { playbackStyle } from "../families/deploy/deploy.shared";
import { packKeys } from "./pack.i18n";
import { svgToDataUri } from "./pack.icons";
import type { ElementPack, PackShape } from "./pack.schema";

function customColorOf(comp: Component): string | undefined {
  return "customColor" in comp && typeof comp.customColor === "string"
    ? comp.customColor
    : undefined;
}

/** XML-escapes an attribute value (path data is validated, colours are user input). */
function attr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/**
 * The outline as a standalone SVG, for draw.io export. The theme's custom properties do not
 * exist outside the app, so the stroke is the node's own colour or a neutral grey.
 */
function shapeSvg(shape: Pick<PackShape, "viewBox" | "paths">, stroke = "#64748b"): string {
  const paths = shape.paths
    .map(
      (d) =>
        `<path d="${attr(d)}" fill="#ffffff" stroke="${attr(stroke)}" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${attr(shape.viewBox)}" preserveAspectRatio="none">${paths}</svg>`;
}

/** One `ElementDescriptor` per pack shape, offered in the pack's palette group. */
export function buildShapeDescriptors(
  pack: ElementPack,
  typeOf: (localId: string) => ElementTypeId,
): ElementDescriptor[] {
  return pack.shapes.map((shape) => {
    const type = typeOf(shape.id);
    const size = shape.size ?? SHAPE_DEFAULT_SIZE;
    return {
      id: type,
      family: pack.id,
      labelKey: packKeys.shapeLabel(pack.id, shape.id),
      descriptionKey: packKeys.shapeDescription(pack.id, shape.id),

      model: {
        createComponent: (base) => {
          if (!isPluginComponentType(type)) {
            throw new Error(`[element-packs] shape type "${type}" is not namespaced.`);
          }
          return { ...base, type };
        },
        defaultSize: size,
        patchableKeys: ["customColor"],
      },

      canvas: {
        rfType: type,
        component: ShapeNode,
        handles: SINGLE_PAIR_HANDLES,
        role: "custom-shape",
        zIndex: 1,
        connectable: true,
        canHaveParent: true,
        canBeParent: false,
        canBeConnectionSource: true,
        derivesSize: false,
        buildData: (comp, ctx) => ({
          elementId: comp.id,
          name: comp.name,
          viewBox: shape.viewBox,
          paths: shape.paths,
          customColor: customColorOf(comp),
          laneAccent: laneAccentFor(comp, ctx),
          isSelected: ctx.isPlaying
            ? ctx.flowHighlight.activeNodeId === comp.id
            : ctx.selectedNodeId === comp.id,
        }),
        buildStyle: (comp, ctx) => {
          const layout = ctx.resolvedNodeLayouts[comp.id];
          return {
            width: layout?.width ?? size.width,
            height: layout?.height ?? size.height,
            ...playbackStyle(comp, ctx),
          };
        },
      },

      palette: {
        categoryId: pack.id,
        icon: { kind: "lucide", icon: Shapes },
        accent: { kind: "neutral" },
        searchKeys: [shape.id, pack.id, ...(shape.searchKeys ?? [])],
      },

      inspector: {},

      export: {
        drawio: {
          toExportNode: (comp, base) => ({
            ...base,
            kind: "image",
            name: comp.name,
            dataUri: svgToDataUri(shapeSvg(shape, customColorOf(comp))),
            preserveAspect: false,
          }),
        },
      },
    };
  });
}
