import CustomNode from "@/features/canvas/nodes/CustomNode";
import type { NodeTypeDescriptor } from "./types";
import { SPREAD_HANDLES } from "./handle-spec";
import { buildCardNodeData, buildCardNodeStyle } from "../CustomNode/buildCardNodeData";

/** @deprecated Prefer `buildCardNodeStyle` — kept for existing imports. */
export const buildC4Style = buildCardNodeStyle;

export const c4Descriptor: NodeTypeDescriptor = {
  rfType: "c4",
  component: CustomNode,

  matches: () => true,
  zIndex: 1,
  connectable: true,
  handles: SPREAD_HANDLES,
  canHaveParent: true,
  canBeParent: false,

  buildData: buildCardNodeData,
  buildStyle: buildCardNodeStyle,
};
