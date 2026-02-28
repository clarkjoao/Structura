import { memo, useCallback } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Network, Server, Database, User, MousePointerClick } from "lucide-react";
import type { C4ElementType } from "@/lib/model-types";

export interface C4NodeData {
  elementId: string;
  name: string;
  type: C4ElementType;
  description: string;
  technology?: string;
  canDrillDown: boolean;
  isSelected: boolean;
  onDrillDown: (elementId: string) => void;
  onSelect: (elementId: string) => void;
}

const typeConfig: Record<C4ElementType, { icon: typeof Network; colorClass: string; borderClass: string; bgClass: string }> = {
  person:    { icon: User,    colorClass: "text-node-person",    borderClass: "border-node-person/40",    bgClass: "bg-node-person/5" },
  system:    { icon: Network, colorClass: "text-node-system",    borderClass: "border-node-system/40",    bgClass: "bg-node-system/5" },
  container: { icon: Server,  colorClass: "text-node-container", borderClass: "border-node-container/40", bgClass: "bg-node-container/5" },
  component: { icon: Database, colorClass: "text-node-component", borderClass: "border-node-component/40", bgClass: "bg-node-component/5" },
};

const C4Node = memo(({ data }: NodeProps) => {
  const d = data as unknown as C4NodeData;
  const cfg = typeConfig[d.type];
  const Icon = cfg.icon;

  const handleDrillDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    d.onDrillDown(d.elementId);
  }, [d]);

  return (
    <div
      className={`relative rounded-xl border-2 ${cfg.borderClass} ${cfg.bgClass} backdrop-blur-sm min-w-[180px] max-w-[240px] transition-shadow duration-200 ${
        d.isSelected ? "ring-2 ring-primary shadow-lg shadow-primary/10" : ""
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground !border-background !w-2.5 !h-2.5" />

      <div className="px-4 py-3">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1.5">
          <Icon className={`h-4 w-4 ${cfg.colorClass} shrink-0`} />
          <span className={`text-[10px] font-mono uppercase tracking-wider ${cfg.colorClass}`}>
            {d.type}
          </span>
        </div>

        {/* Name */}
        <h4 className="text-sm font-semibold text-foreground leading-tight mb-1">{d.name}</h4>

        {/* Description */}
        {d.description && (
          <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{d.description}</p>
        )}

        {/* Technology badge */}
        {d.technology && (
          <span className="inline-block mt-2 text-[10px] font-mono rounded bg-secondary px-2 py-0.5 text-secondary-foreground">
            {d.technology}
          </span>
        )}

        {/* Drill-down button */}
        {d.canDrillDown && (
          <button
            onClick={handleDrillDown}
            className={`mt-2 flex items-center gap-1 text-[10px] font-medium ${cfg.colorClass} hover:underline`}
          >
            <MousePointerClick className="h-3 w-3" />
            Explorar interior
          </button>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground !border-background !w-2.5 !h-2.5" />
    </div>
  );
});

C4Node.displayName = "C4Node";

export default C4Node;
