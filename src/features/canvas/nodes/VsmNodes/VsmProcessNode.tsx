import { memo } from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import { Factory, User } from "lucide-react";
import type { VsmMetric } from "@/features/diagram/model/component.types";
import { FLOW_DEFAULT_ACCENT } from "../ProcessNode/flowAppearance";
import { SkinHandles } from "./SkinHandles";
import { VSM_SIZE_LIMITS } from "./vsmSizeLimits";
import { useSkinPalette, type SkinNodeData } from "./skin";

export type VsmProcessNodeData = SkinNodeData & {
  operators?: number;
  metrics?: VsmMetric[];
};

const DEFAULT_W = 200;
const DEFAULT_H = 150;

/**
 * A VSM process box: the C4 card's skin (accent bar, surface, shadow) with a
 * header — icon, title, operator count — over the data box, a key/value table
 * in mono with the values right-aligned.
 */
const VsmProcessNode = memo(
  ({ data: d, selected, width, height }: NodeProps<Node<VsmProcessNodeData>>) => {
    const palette = useSkinPalette(d, FLOW_DEFAULT_ACCENT);
    const isSelected = !!(selected || d.isSelected);
    const w = width || DEFAULT_W;
    const h = height || DEFAULT_H;
    const metrics = d.metrics ?? [];

    return (
      <>
        <NodeResizer
          {...VSM_SIZE_LIMITS["vsm-process"]}
          isVisible={isSelected}
          lineClassName="!border-transparent"
          handleClassName="!w-2 !h-2 !bg-foreground/40 !border-background !rounded-sm"
        />
        <SkinHandles left={{ x: 0, y: h / 2 }} right={{ x: w, y: h / 2 }} w={w} h={h} />
        <div
          className={`absolute inset-0 flex flex-col overflow-hidden rounded-lg shadow-sm ${
            isSelected ? "ring-2 ring-primary" : ""
          }`}
          style={{
            background: palette.surface,
            borderColor: palette.border,
            borderStyle: palette.borderStyle,
            borderWidth: palette.borderStyle === "dashed" ? 1.5 : 1,
            borderLeft: `3px solid ${palette.accent}`,
          }}
        >
          <div className="flex shrink-0 items-center gap-2 px-3 pt-2.5 pb-2">
            <Factory size={16} strokeWidth={1.75} color={palette.icon} className="shrink-0" />
            <span
              className="min-w-0 flex-1 select-none truncate text-sm font-semibold"
              style={{ color: palette.title }}
            >
              {d.name}
            </span>
            {d.operators !== undefined && (
              <span
                className="flex shrink-0 select-none items-center gap-0.5 font-mono text-[11px]"
                style={{ color: palette.muted }}
                aria-label={String(d.operators)}
              >
                <User size={12} strokeWidth={1.75} color={palette.icon} />
                {d.operators}
              </span>
            )}
          </div>
          {metrics.length > 0 && (
            <dl
              className="min-h-0 flex-1 overflow-hidden border-t px-3 py-1.5 font-mono text-[11px] leading-5"
              style={{ borderColor: palette.border }}
            >
              {metrics.map((metric) => (
                <div key={metric.id} className="flex justify-between gap-2">
                  <dt className="truncate select-none" style={{ color: palette.muted }}>
                    {metric.key}
                  </dt>
                  <dd className="shrink-0 select-none text-right" style={{ color: palette.title }}>
                    {metric.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </>
    );
  },
);

VsmProcessNode.displayName = "VsmProcessNode";

export default VsmProcessNode;
