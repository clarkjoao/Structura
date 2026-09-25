import { Triangle } from "lucide-react";
import VsmInventoryNode from "@/features/canvas/nodes/VsmNodes/VsmInventoryNode";
import { VSM_AMBER } from "@/features/canvas/nodes/VsmNodes/vsmAccents";
import { COMPONENT_TYPE_VSM_INVENTORY } from "@/features/diagram/model/component-type-constants";
import { isVsmInventoryComponent } from "@/features/diagram/model/component.guards";
import type { VsmInventoryComponent } from "@/features/diagram/model/component.types";
import { defineVsmElement } from "./vsm.shared";

export const vsmInventoryElement = defineVsmElement<VsmInventoryComponent>({
  id: COMPONENT_TYPE_VSM_INVENTORY,
  node: VsmInventoryNode,
  guard: isVsmInventoryComponent,
  create: (base) => ({ ...base, type: COMPONENT_TYPE_VSM_INVENTORY }),
  size: { width: 96, height: 110 },
  icon: Triangle,
  searchKeys: ["inventory", "estoque", "stock", "wip", "queue"],
  defaultAccent: VSM_AMBER,
  fields: ["quantity", "duration"],
  connectable: true,
  // Confirmed registered in draw.io's mxLeanMap.js; the label goes below it,
  // as in draw.io's own Lean Mapping sidebar entry.
  shapeStyle:
    "shape=mxgraph.lean_mapping.inventory_box;strokeWidth=2;verticalLabelPosition=bottom;verticalAlign=top;",
  exportLabel: (comp) => [comp.quantity, comp.duration].filter(Boolean).join("\n"),
});
