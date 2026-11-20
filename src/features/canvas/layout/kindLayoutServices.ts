import type { DiagramLayoutSettings } from "@/features/diagram/model/layout-settings";
import { LAYOUT_DENSITY_FACTOR, clampLayoutGap } from "@/features/diagram/model/layout-settings";
import type { KindLayoutServices, MeasuredSizes } from "@/features/diagram-kinds/kind.types";

/** A kind arrangement's default gaps at normal density: between columns, between stacked nodes. */
const KIND_COLUMN_GAP = 96;
const KIND_STACK_GAP = 32;

/** The gaps a kind arrangement uses under a diagram's density and overrides. */
export function kindLayoutGaps(settings: DiagramLayoutSettings | undefined): {
  layer: number;
  node: number;
} {
  const factor = LAYOUT_DENSITY_FACTOR[settings?.density ?? "normal"] ?? 1;
  const layer =
    typeof settings?.layerGap === "number" && Number.isFinite(settings.layerGap)
      ? clampLayoutGap(settings.layerGap)
      : Math.round(KIND_COLUMN_GAP * factor);
  const node =
    typeof settings?.nodeGap === "number" && Number.isFinite(settings.nodeGap)
      ? clampLayoutGap(settings.nodeGap)
      : Math.round(KIND_STACK_GAP * factor);
  return { layer, node };
}

export function kindLayoutServices(
  settings: DiagramLayoutSettings | undefined,
  measured: MeasuredSizes = {},
): KindLayoutServices {
  return { measured, gaps: kindLayoutGaps(settings) };
}
