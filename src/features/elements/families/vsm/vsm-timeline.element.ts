import { Activity } from "lucide-react";
import VsmTimelineNode from "@/features/canvas/nodes/VsmNodes/VsmTimelineNode";
import { FLOW_DEFAULT_ACCENT } from "@/features/canvas/nodes/ProcessNode/flowAppearance";
import { COMPONENT_TYPE_VSM_TIMELINE } from "@/features/diagram/model/component-type-constants";
import { isVsmTimelineComponent } from "@/features/diagram/model/component.guards";
import type { VsmTimelineComponent } from "@/features/diagram/model/component.types";
import { DEFAULT_VSM_TIME_UNIT, vsmTimelineTotals } from "@/features/diagram/utils/vsm-timeline";
import i18n from "@/infrastructure/i18n";
import { defineVsmElement } from "./vsm.shared";

const TIMELINE_W = 560;

/**
 * draw.io's timeline2 draws at most five plateaus, placed by `dx2..dx5` and
 * levelled by `dy1..dy6` (0 = up, 1 = down; see mxShapeLeanTimeline). The
 * first five plateaus of the wave go there; the totals, over every segment,
 * go in the label.
 */
function timeline2Style(comp: VsmTimelineComponent, width: number): string {
  const levels = (comp.segments ?? []).flatMap(() => [0, 1]).slice(0, 5);
  const plateaus = Math.max(1, levels.length);
  const step = width / plateaus;
  const style: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    style.push(`dy${i + 1}=${levels[Math.min(i, levels.length - 1)] ?? 0}`);
  }
  for (let i = 2; i <= 5; i += 1) {
    style.push(`dx${i}=${Math.round(Math.min(i - 1, plateaus) * step)}`);
  }
  return style.join(";") + ";";
}

export const vsmTimelineElement = defineVsmElement<VsmTimelineComponent>({
  id: COMPONENT_TYPE_VSM_TIMELINE,
  node: VsmTimelineNode,
  guard: isVsmTimelineComponent,
  create: (base) => ({
    ...base,
    type: COMPONENT_TYPE_VSM_TIMELINE,
    // One segment to start from, ids derived from the component's so creation
    // stays deterministic.
    segments: [{ id: `${base.id}-s0`, wait: 0, process: 0 }],
  }),
  size: { width: TIMELINE_W, height: 110 },
  icon: Activity,
  searchKeys: ["timeline", "linha do tempo", "lead time", "value added", "agregação"],
  defaultAccent: FLOW_DEFAULT_ACCENT,
  fields: ["segments", "unit"],
  connectable: false,
  // Confirmed registered in draw.io's mxLeanMap.js (mxShapeLeanTimeline).
  shapeStyle: (comp, width) =>
    "shape=mxgraph.lean_mapping.timeline2;strokeWidth=2;verticalLabelPosition=bottom;" +
    `verticalAlign=top;${timeline2Style(comp, width)}`,
  exportLabel: (comp) => {
    const totals = vsmTimelineTotals(comp.segments ?? []);
    const unit = comp.unit ?? DEFAULT_VSM_TIME_UNIT;
    return [
      `${i18n.t("vsm.timeline.leadTime", { lng: "en" })}: ${totals.leadTime} ${unit}`,
      `${i18n.t("vsm.timeline.valueAdded", { lng: "en" })}: ${totals.valueAdded} ${unit}`,
    ].join("\n");
  },
});
