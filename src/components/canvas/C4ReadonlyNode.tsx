import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Network, Server, Database, User } from "lucide-react";
import type { ComponentType } from "@/lib/model-types";

interface ReadonlyNodeData {
  name: string;
  type: ComponentType;
  description: string;
  technology?: string;
}

const TypeConfig: Record<string, { icon: typeof Network; borderColor: string; textColor: string }> = {
  person: { icon: User, borderColor: "border-l-node-person", textColor: "text-node-person" },
  system: { icon: Network, borderColor: "border-l-node-system", textColor: "text-node-system" },
  container: { icon: Server, borderColor: "border-l-node-container", textColor: "text-node-container" },
  component: { icon: Database, borderColor: "border-l-node-component", textColor: "text-node-component" },
};

const handleStyle = "!bg-muted-foreground/50 !border-background !w-2 !h-2";

const C4ReadonlyNode = memo(({ data }: NodeProps) => {
  const d = data as unknown as ReadonlyNodeData;
  const cfg = TypeConfig[d.type] ?? TypeConfig.system;
  const Icon = cfg.icon;

  return (
    <div className={`min-w-[180px] max-w-[240px] rounded-lg bg-card/80 border border-border/60 ${cfg.borderColor} border-l-[3px] opacity-75`}>
      <Handle type="target" position={Position.Left} className={handleStyle} />
      <div className="px-2.5 py-2">
        <div className="flex items-center gap-1.5 mb-1">
          <Icon className={`h-3.5 w-3.5 ${cfg.textColor} shrink-0`} />
          <span className="text-xs font-semibold text-foreground leading-tight truncate">{d.name}</span>
        </div>
        {d.description && <p className="text-[10px] text-muted-foreground leading-snug line-clamp-1">{d.description}</p>}
        {d.technology && <span className="inline-block mt-1 text-[9px] font-mono rounded bg-secondary/70 px-1 py-0.5 text-secondary-foreground">{d.technology}</span>}
      </div>
      <Handle type="source" position={Position.Right} className={handleStyle} />
    </div>
  );
});

C4ReadonlyNode.displayName = "C4ReadonlyNode";

export default C4ReadonlyNode;
