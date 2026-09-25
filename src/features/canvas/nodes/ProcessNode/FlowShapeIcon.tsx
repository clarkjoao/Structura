import {
  ArrowLeftRight,
  CircleDot,
  Eye,
  FileText,
  GitFork,
  Layers,
  Repeat,
  Settings2,
  Zap,
  type LucideProps,
} from "lucide-react";
import type { FlowNodeShape } from "@/features/diagram/model/component.types";

/**
 * ArchiMate's process glyph — a block arrow — drawn like a lucide icon (24-unit
 * box, round joins) so it sits beside the others without looking borrowed.
 */
function ProcessGlyph({ size = 16, strokeWidth = 1.75, color, className, style }: LucideProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? "currentColor"}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden
    >
      <path d="M4 8h9V5l7 7-7 7v-3H4z" />
    </svg>
  );
}

type IconComponent = (props: LucideProps) => React.ReactNode;

/**
 * The shape says the role, the icon says the type — the ArchiMate split. A
 * shape whose silhouette already says everything (the data store, the
 * start/end circle) has none.
 */
const SHAPE_ICONS: Record<FlowNodeShape, IconComponent | null> = {
  rectangle: ProcessGlyph,
  rounded: Repeat,
  subroutine: Layers,
  stadium: CircleDot,
  diamond: GitFork,
  hexagon: Settings2,
  parallelogram: ArrowLeftRight,
  cylinder: null,
  circle: null,
  start: null,
  end: null,
  document: FileText,
  event: Zap,
  "junction-and": null,
  "junction-or": null,
  annotation: null,
  evidence: Eye,
};

export function FlowShapeIcon({
  shape,
  color,
  size = 16,
}: {
  shape: FlowNodeShape;
  color: string;
  size?: number;
}) {
  const Icon = SHAPE_ICONS[shape];
  if (!Icon) return null;
  return <Icon size={size} strokeWidth={1.75} color={color} className="shrink-0" aria-hidden />;
}
