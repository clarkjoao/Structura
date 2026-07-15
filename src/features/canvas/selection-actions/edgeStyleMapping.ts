/**
 * Maps the user-facing edge-style dropdown options (used in toolbar) to
 * the canonical EdgeStyle saved on the connection.
 *
 * Step (RETO) and Smoothstep (ARREDONDADO) in the toolbar should map to
 * the editable variants so users can immediately add/drag control points
 * after picking them. Bezier/Straight have no editable counterpart.
 */

export type EdgeStyleDropdownValue =
  | "step"
  | "smoothstep"
  | "bezier"
  | "straight";

import type { EdgeStyle } from "@/features/diagram";

export const dropdownToEdgeStyle = (
  value: EdgeStyleDropdownValue,
): EdgeStyle => {
  switch (value) {
    case "step":
      return "editable-step" as EdgeStyle;
    case "smoothstep":
      return "editable" as EdgeStyle;
    case "bezier":
      return "bezier" as EdgeStyle;
    case "straight":
      return "straight" as EdgeStyle;
  }
};

export const edgeStyleToDropdown = (
  style: EdgeStyle | undefined,
): EdgeStyleDropdownValue => {
  switch (style) {
    case ("editable-step" as EdgeStyle):
      return "step";
    case ("editable" as EdgeStyle):
      return "smoothstep";
    case "bezier":
      return "bezier";
    case "straight":
      return "straight";
    default:
      return "smoothstep";
  }
};
