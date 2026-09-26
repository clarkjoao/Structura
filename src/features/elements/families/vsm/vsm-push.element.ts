import { MoveRight } from "lucide-react";
import VsmPushNode from "@/features/canvas/nodes/VsmNodes/VsmPushNode";
import { FLOW_DEFAULT_ACCENT } from "@/features/canvas/nodes/ProcessNode/flowAppearance";
import { COMPONENT_TYPE_VSM_PUSH } from "@/features/diagram/model/component-type-constants";
import { isVsmPushComponent } from "@/features/diagram/model/component.guards";
import type { VsmPushComponent } from "@/features/diagram/model/component.types";
import { defineVsmElement } from "./vsm.shared";

export const vsmPushElement = defineVsmElement<VsmPushComponent>({
  id: COMPONENT_TYPE_VSM_PUSH,
  node: VsmPushNode,
  guard: isVsmPushComponent,
  create: (base) => ({ ...base, type: COMPONENT_TYPE_VSM_PUSH }),
  size: { width: 110, height: 40 },
  icon: MoveRight,
  searchKeys: ["push", "empurrar", "arrow", "seta"],
  defaultAccent: FLOW_DEFAULT_ACCENT,
  fields: [],
  connectable: false,
  // Confirmed registered in draw.io's mxLeanMap.js.
  shapeStyle: "shape=mxgraph.lean_mapping.push_arrow;strokeWidth=2;noLabel=1;",
  exportLabel: (comp) => comp.name,
});
