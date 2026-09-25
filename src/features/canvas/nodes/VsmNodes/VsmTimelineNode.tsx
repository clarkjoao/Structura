import { memo } from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import type { VsmTimelineSegment, VsmTimeUnit } from "@/features/diagram/model/component.types";
import { DEFAULT_VSM_TIME_UNIT, vsmTimelineTotals } from "@/features/diagram/utils/vsm-timeline";
import { FLOW_DEFAULT_ACCENT } from "../ProcessNode/flowAppearance";
import { SkinHandles } from "./SkinHandles";
import { useSkinPalette, type SkinNodeData } from "./skin";
import { TIMELINE_TOTALS_W, timelineWave } from "./vsmGeometry";

export type VsmTimelineNodeData = SkinNodeData & {
  segments?: VsmTimelineSegment[];
  unit?: VsmTimeUnit;
};

const PRIMARY = "hsl(var(--primary))";
const DEFAULT_W = 560;
const DEFAULT_H = 110;

/**
 * The timeline: a 2px square wave in the accent — each segment a high plateau
 * (waiting, its time written above) then a low one (processing, its time
 * written below) — and a card on the right with the two totals, which are
 * computed from the segments and never stored.
 */
const VsmTimelineNode = memo(
  ({ data: d, selected, width, height }: NodeProps<Node<VsmTimelineNodeData>>) => {
    const { t } = useTranslation();
    const palette = useSkinPalette(d, FLOW_DEFAULT_ACCENT);
    const isSelected = !!(selected || d.isSelected);
    const w = width || DEFAULT_W;
    const h = height || DEFAULT_H;
    const segments = d.segments ?? [];
    const unit = t(`vsm.units.${d.unit ?? DEFAULT_VSM_TIME_UNIT}`);
    const wave = timelineWave(segments.length, w, h);
    const totals = vsmTimelineTotals(segments);

    return (
      <>
        <NodeResizer
          minWidth={240}
          minHeight={80}
          isVisible={isSelected}
          lineClassName="!border-transparent"
          handleClassName="!w-2 !h-2 !bg-foreground/40 !border-background !rounded-sm"
        />
        <SkinHandles left={{ x: 0, y: h / 2 }} right={{ x: w, y: h / 2 }} w={w} h={h} inert />
        <svg
          className="absolute inset-0 h-full w-full overflow-visible"
          viewBox={`0 0 ${w} ${h}`}
          aria-hidden
        >
          <path
            d={wave.path}
            fill="none"
            stroke={isSelected ? PRIMARY : palette.accent}
            strokeWidth={2}
            strokeDasharray={palette.dashArray}
            strokeLinejoin="round"
          />
        </svg>
        {segments.map((segment, index) => (
          <div key={segment.id}>
            <span
              className="pointer-events-none absolute -translate-x-1/2 select-none whitespace-nowrap font-mono text-xs"
              style={{ left: wave.waitCentres[index], top: wave.high - 20, color: palette.title }}
            >
              {segment.wait} {unit}
            </span>
            <span
              className="pointer-events-none absolute -translate-x-1/2 select-none whitespace-nowrap font-mono text-xs"
              style={{ left: wave.processCentres[index], top: wave.low + 6, color: palette.title }}
            >
              {segment.process} {unit}
            </span>
          </div>
        ))}
        <div
          className="absolute inset-y-1 right-0 flex flex-col justify-center gap-1 rounded-lg border px-3 shadow-sm"
          style={{
            width: TIMELINE_TOTALS_W,
            background: palette.surface,
            borderColor: palette.border,
            borderLeft: `3px solid ${palette.accent}`,
          }}
        >
          <Total label={t("vsm.timeline.leadTime")} value={`${totals.leadTime} ${unit}`} />
          <Total label={t("vsm.timeline.valueAdded")} value={`${totals.valueAdded} ${unit}`} />
        </div>
      </>
    );
  },
);

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="select-none truncate text-[11px] text-muted-foreground">{label}</p>
      <p className="select-none truncate text-xl font-bold leading-tight text-foreground">
        {value}
      </p>
    </div>
  );
}

VsmTimelineNode.displayName = "VsmTimelineNode";

export default VsmTimelineNode;
