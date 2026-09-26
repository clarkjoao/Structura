import type { SkinParts } from "@/features/diagram/model/component.types";
import {
  flowPalette,
  resolveFlowAppearance,
  type FlowPalette,
} from "../ProcessNode/flowAppearance";
import { useOnAccentColor } from "../ProcessNode/useOnAccentColor";

/**
 * The flow skin's palette for any element that wears it, from its stored
 * parts and its own default accent. Same resolution as the flowchart shapes:
 * defaults at render, never written; text on a solid fill by contrast.
 */
export function useSkinPalette(
  parts: SkinParts & { laneAccent?: string },
  defaultAccent: string,
): FlowPalette {
  // Own accent, else the lane's, else the element's default.
  const appearance = resolveFlowAppearance(parts, parts.laneAccent ?? defaultAccent);
  const onAccent = useOnAccentColor(appearance.accent, appearance.fill === "solid");
  return flowPalette(appearance, onAccent);
}

/** The node data every skinned VSM element receives. */
export type SkinNodeData = {
  customColor?: SkinParts["customColor"];
  fill?: SkinParts["fill"];
  stroke?: SkinParts["stroke"];
  /** The accent of the swimlane it sits in, when that lane passes one on. */
  laneAccent?: string;
  elementId: string;
  name: string;
  description?: string;
  isSelected?: boolean;
};
