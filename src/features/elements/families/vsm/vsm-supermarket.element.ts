import { AlignRight } from "lucide-react";
import VsmSupermarketNode from "@/features/canvas/nodes/VsmNodes/VsmSupermarketNode";
import { FLOW_DEFAULT_ACCENT } from "@/features/canvas/nodes/ProcessNode/flowAppearance";
import { COMPONENT_TYPE_VSM_SUPERMARKET } from "@/features/diagram/model/component-type-constants";
import { isVsmSupermarketComponent } from "@/features/diagram/model/component.guards";
import type { VsmSupermarketComponent } from "@/features/diagram/model/component.types";
import { defineVsmElement } from "./vsm.shared";

export const vsmSupermarketElement = defineVsmElement<VsmSupermarketComponent>({
  id: COMPONENT_TYPE_VSM_SUPERMARKET,
  node: VsmSupermarketNode,
  guard: isVsmSupermarketComponent,
  create: (base) => ({ ...base, type: COMPONENT_TYPE_VSM_SUPERMARKET }),
  size: { width: 60, height: 72 },
  icon: AlignRight,
  searchKeys: ["supermarket", "supermercado", "kanban", "pull", "puxada"],
  defaultAccent: FLOW_DEFAULT_ACCENT,
  fields: [],
  connectable: true,
  // Confirmed registered in draw.io's mxLeanMap.js.
  shapeStyle:
    "shape=mxgraph.lean_mapping.supermarket;strokeWidth=2;verticalLabelPosition=bottom;verticalAlign=top;",
  exportLabel: (comp) => comp.name,
});
