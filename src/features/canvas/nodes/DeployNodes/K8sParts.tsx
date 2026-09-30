import type { ReactNode } from "react";
import { NodeResizer } from "@xyflow/react";
import { mix } from "../ProcessNode/flowAppearance";
import type { FlowPalette } from "../ProcessNode/flowAppearance";
import { DeployHandles } from "./DeployParts";

/**
 * A generic helm glyph — a wheel with seven spokes — drawn in the lucide
 * style. Deliberately not the Kubernetes logo, which is a trademark.
 */
export function HelmGlyph({ color, size = 16 }: { color: string; size?: number }) {
  const spokes = Array.from({ length: 7 }, (_, i) => (i * 2 * Math.PI) / 7 - Math.PI / 2);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <circle cx="12" cy="12" r="6.5" stroke={color} strokeWidth={1.75} />
      <circle cx="12" cy="12" r="2" stroke={color} strokeWidth={1.75} />
      {spokes.map((a) => (
        <line
          key={a}
          x1={12 + Math.cos(a) * 2}
          y1={12 + Math.sin(a) * 2}
          x2={12 + Math.cos(a) * 10}
          y2={12 + Math.sin(a) * 10}
          stroke={color}
          strokeWidth={1.75}
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

/** The dashed-square glyph of a namespace. */
export function NamespaceGlyph({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <rect
        x="4"
        y="4"
        width="16"
        height="16"
        rx="2"
        stroke={color}
        strokeWidth={1.75}
        strokeDasharray="3 2.5"
      />
    </svg>
  );
}

/**
 * A Kubernetes container frame (cluster, namespace): the panel style — a
 * light wash of the accent, a 1.5px border, radius 12 — dashed for a logical
 * grouping. Compact, it is just its header.
 */
export function K8sFrame({
  palette,
  icon,
  name,
  caption,
  chips,
  dashed,
  collapsed,
  isSelected,
  elementId,
  incomingCount,
  outgoingCount,
  minWidth,
}: {
  palette: FlowPalette;
  icon: ReactNode;
  name: string;
  caption?: string;
  chips: ReactNode;
  dashed: boolean;
  collapsed: boolean;
  isSelected: boolean;
  elementId: string;
  incomingCount: number;
  outgoingCount: number;
  minWidth: number;
}) {
  const accent = palette.accent;
  return (
    <>
      <NodeResizer
        minWidth={minWidth}
        minHeight={collapsed ? 64 : 160}
        isVisible={isSelected && !collapsed}
        lineClassName="!border-transparent"
        handleClassName="!w-2 !h-2 !bg-foreground/40 !border-background !rounded-sm"
      />
      <DeployHandles
        elementId={elementId}
        incomingCount={incomingCount}
        outgoingCount={outgoingCount}
      />
      <div
        className={`flex h-full w-full flex-col gap-1.5 overflow-hidden rounded-xl px-3 py-2.5 ${
          collapsed ? "shadow-sm" : ""
        } ${isSelected ? "ring-2 ring-primary" : ""}`}
        style={{
          background: collapsed ? palette.surface : mix(accent, 4),
          border: `1.5px ${dashed ? "dashed" : palette.borderStyle} ${mix(accent, 45, "transparent")}`,
          ...(collapsed ? { borderLeft: `3px solid ${accent}` } : {}),
        }}
      >
        <div className="flex min-w-0 items-center gap-2">
          {icon}
          <span
            className="min-w-0 truncate select-none text-sm font-semibold"
            style={{ color: palette.title }}
          >
            {name}
          </span>
          {caption && (
            <span className="shrink-0 select-none text-xs" style={{ color: palette.muted }}>
              {caption}
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-wrap gap-1">{chips}</div>
      </div>
    </>
  );
}
