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
export function useSkinPalette(parts: SkinParts, defaultAccent: string): FlowPalette {
  const appearance = resolveFlowAppearance(parts, defaultAccent);
  const onAccent = useOnAccentColor(appearance.accent, appearance.fill === "solid");
  return flowPalette(appearance, onAccent);
}

/** The node data every skinned VSM element receives. */
export type SkinNodeData = {
  customColor?: SkinParts["customColor"];
  fill?: SkinParts["fill"];
  stroke?: SkinParts["stroke"];
  elementId: string;
  name: string;
  description?: string;
  isSelected?: boolean;
};
