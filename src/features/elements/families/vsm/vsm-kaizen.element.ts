import { Sparkles } from "lucide-react";
import VsmKaizenNode from "@/features/canvas/nodes/VsmNodes/VsmKaizenNode";
import { VSM_AMBER } from "@/features/canvas/nodes/VsmNodes/vsmAccents";
import { COMPONENT_TYPE_VSM_KAIZEN } from "@/features/diagram/model/component-type-constants";
import { isVsmKaizenComponent } from "@/features/diagram/model/component.guards";
import type { VsmKaizenComponent } from "@/features/diagram/model/component.types";
import { defineVsmElement } from "./vsm.shared";

export const vsmKaizenElement = defineVsmElement<VsmKaizenComponent>({
  id: COMPONENT_TYPE_VSM_KAIZEN,
  node: VsmKaizenNode,
  guard: isVsmKaizenComponent,
  create: (base) => ({ ...base, type: COMPONENT_TYPE_VSM_KAIZEN }),
  size: { width: 150, height: 96 },
  icon: Sparkles,
  searchKeys: ["kaizen", "improvement", "melhoria", "burst"],
  defaultAccent: VSM_AMBER,
  fields: [],
  connectable: false,
  // A stencil from draw.io's stencils/lean_mapping.xml ("Kaizen Lightening
  // Burst"), under the name its Lean Mapping sidebar uses.
  shapeStyle: "shape=mxgraph.lean_mapping.kaizen_lightening_burst;strokeWidth=2;",
  exportLabel: (comp) => comp.name,
});
