import { memo, useCallback } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Network, Server, Database, User, MousePointerClick, Link2 } from "lucide-react";
import type { ComponentType } from "@/lib/model-types";
import { isAwsType, AWS_SERVICE_MAP, AWS_CATEGORY_MAP } from "@/lib/aws-catalog";
import { useCanNavigateInto } from "@/lib/model-store";
import AwsIcon from "./AwsIcon";

export interface NodeData {
  elementId: string;
  name: string;
  type: ComponentType;
  description: string;
  technology?: string;
  awsService?: string;
  isSelected: boolean;
  onDrillDown: (elementId: string) => void;
  onSelect: (elementId: string) => void;
  serviceName?: string;
}

const TypeConfig: Record<string, { icon: typeof Network; borderColor: string; textColor: string }> = {
  person: { icon: User, borderColor: "border-l-node-person", textColor: "text-node-person" },
  system: { icon: Network, borderColor: "border-l-node-system", textColor: "text-node-system" },
  container: { icon: Server, borderColor: "border-l-node-container", textColor: "text-node-container" },
  component: { icon: Database, borderColor: "border-l-node-component", textColor: "text-node-component" },
};

const awsCategoryBorders: Record<string, string> = {
  "aws-compute": "border-l-aws-compute", "aws-storage": "border-l-aws-storage", "aws-database": "border-l-aws-database",
  "aws-networking": "border-l-aws-networking", "aws-security": "border-l-aws-security", "aws-analytics": "border-l-aws-analytics",
  "aws-ml": "border-l-aws-ml", "aws-integration": "border-l-aws-integration", "aws-management": "border-l-aws-management",
  "aws-developer": "border-l-aws-developer", "aws-containers": "border-l-aws-containers", "aws-media": "border-l-aws-media",
  "aws-migration": "border-l-aws-migration", "aws-iot": "border-l-aws-iot", "aws-end-user": "border-l-aws-end-user",
  "aws-general": "border-l-aws-general",
};

const handleStyle = "!bg-muted-foreground !border-background !w-2.5 !h-2.5";

const CardNode = memo(({ data }: NodeProps) => {
  const d = data as unknown as NodeData;
  const isAws = isAwsType(d.type);
  const canDrillDown = useCanNavigateInto(d.elementId);

  const handleDrillDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    d.onDrillDown(d.elementId);
  }, [d]);

  if (isAws) {
    const svcInfo = d.awsService ? AWS_SERVICE_MAP.get(d.awsService) : null;
    const catInfo = AWS_CATEGORY_MAP.get(d.type);
    const borderClass = awsCategoryBorders[d.type] ?? "border-l-aws-general";

    return (
      <div className={`min-w-[200px] max-w-[260px] rounded-lg bg-card border border-border ${borderClass} border-l-[3px] transition-shadow duration-200 ${d.isSelected ? "ring-2 ring-primary shadow-lg shadow-primary/10" : ""}`}>
        <Handle type="target" position={Position.Left} className={handleStyle} />
        <div className="px-3 py-2.5">
          <div className="flex items-center gap-2 mb-1.5">
            {svcInfo?.iconName ? <AwsIcon iconName={svcInfo.iconName} size={20} /> : <Network className="h-4 w-4 text-muted-foreground" />}
            <span className="text-sm font-bold text-foreground leading-tight truncate">{d.name}</span>
          </div>
          {d.description && <p className="text-xs text-muted-foreground leading-snug line-clamp-2 mb-1.5">{d.description}</p>}
          {(d.technology || svcInfo) && (
            <span className="inline-block text-[10px] font-mono rounded bg-secondary px-1.5 py-0.5 text-secondary-foreground">{d.technology ?? catInfo?.name ?? svcInfo?.name}</span>
          )}
          {d.serviceName && (
            <div className="flex items-center gap-1 mt-1.5">
              <Link2 className="h-3 w-3 text-primary shrink-0" />
              <span className="text-[10px] text-primary truncate">{d.serviceName}</span>
            </div>
          )}
          {canDrillDown && (
            <button onClick={handleDrillDown} className="mt-2 flex items-center gap-1 text-[10px] font-medium text-primary hover:underline">
              <MousePointerClick className="h-3 w-3" /> Explorar interior
            </button>
          )}
        </div>
        <Handle type="source" position={Position.Right} className={handleStyle} />
      </div>
    );
  }

  const cfg = TypeConfig[d.type] ?? TypeConfig.system;
  const Icon = cfg.icon;

  return (
    <div className={`min-w-[200px] max-w-[260px] rounded-lg bg-card border border-border ${cfg.borderColor} border-l-[3px] transition-shadow duration-200 ${d.isSelected ? "ring-2 ring-primary shadow-lg shadow-primary/10" : ""}`}>
      <Handle type="target" position={Position.Left} className={handleStyle} />
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2 mb-1.5">
          <Icon className={`h-4 w-4 ${cfg.textColor} shrink-0`} />
          <span className="text-sm font-bold text-foreground leading-tight truncate">{d.name}</span>
        </div>
        {d.description && <p className="text-xs text-muted-foreground leading-snug line-clamp-2 mb-1.5">{d.description}</p>}
        {d.technology && (
          <span className="inline-block text-[10px] font-mono rounded bg-secondary px-1.5 py-0.5 text-secondary-foreground">{d.technology}</span>
        )}
        {d.serviceName && (
          <div className="flex items-center gap-1 mt-1.5">
            <Link2 className="h-3 w-3 text-primary shrink-0" />
            <span className="text-[10px] text-primary truncate">{d.serviceName}</span>
          </div>
        )}
        {canDrillDown && (
          <button onClick={handleDrillDown} className={`mt-2 flex items-center gap-1 text-[10px] font-medium ${cfg.textColor} hover:underline`}>
            <MousePointerClick className="h-3 w-3" /> Explorar interior
          </button>
        )}
      </div>
      <Handle type="source" position={Position.Right} className={handleStyle} />
    </div>
  );
});

CardNode.displayName = "CardNode";
export default CardNode;
