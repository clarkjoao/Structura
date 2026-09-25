import { memo } from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import type { VsmRole } from "@/features/diagram/model/component.types";
import { FLOW_DEFAULT_ACCENT } from "../ProcessNode/flowAppearance";
import { SkinHandles } from "./SkinHandles";
import { useSkinPalette, type SkinNodeData } from "./skin";
import { FACTORY_ROOF, factoryHandles, factoryPaths } from "./vsmGeometry";

export type VsmExternalNodeData = SkinNodeData & { role?: VsmRole };

const PRIMARY = "hsl(var(--primary))";
const DEFAULT_W = 150;
const DEFAULT_H = 96;

/**
 * Supplier or customer: the factory at either end of a value stream. The body
 * is the skin's surface; the saw-tooth roof line is drawn in the accent.
 */
const VsmExternalNode = memo(
  ({ data: d, selected, width, height }: NodeProps<Node<VsmExternalNodeData>>) => {
    const { t } = useTranslation();
    const palette = useSkinPalette(d, FLOW_DEFAULT_ACCENT);
    const isSelected = !!(selected || d.isSelected);
    const w = width || DEFAULT_W;
    const h = height || DEFAULT_H;
    const { body, roof } = factoryPaths(w, h);
    const handles = factoryHandles(w, h);
    const roofH = Math.min(FACTORY_ROOF, h / 3);

    return (
      <>
        <NodeResizer
          minWidth={90}
          minHeight={60}
          isVisible={isSelected}
          lineClassName="!border-transparent"
          handleClassName="!w-2 !h-2 !bg-foreground/40 !border-background !rounded-sm"
        />
        <SkinHandles left={handles.left} right={handles.right} w={w} h={h} />
        <div className="relative h-full w-full">
          <svg
            className="absolute inset-0 h-full w-full overflow-visible drop-shadow-sm"
            viewBox={`0 0 ${w} ${h}`}
            aria-hidden
          >
            <path
              d={body}
              fill={palette.surface}
              stroke={isSelected ? PRIMARY : palette.border}
              strokeWidth={isSelected ? 2.5 : 1.5}
              strokeDasharray={palette.dashArray}
            />
            <path
              d={roof}
              fill={palette.solid ? palette.accent : palette.tint}
              stroke={palette.accent}
              strokeWidth={2}
              strokeLinejoin="round"
            />
          </svg>
          <div
            className="pointer-events-none absolute inset-x-2 bottom-1 flex flex-col items-center justify-center overflow-hidden text-center"
            style={{ top: roofH + 4 }}
          >
            <span
              className="select-none text-sm font-semibold leading-tight line-clamp-2 break-words"
              style={{ color: palette.title }}
            >
              {d.name}
            </span>
            <span className="select-none text-xs" style={{ color: palette.muted }}>
              {t(`vsm.role.${d.role ?? "supplier"}`)}
            </span>
          </div>
        </div>
      </>
    );
  },
);

VsmExternalNode.displayName = "VsmExternalNode";

export default VsmExternalNode;
