import { memo, useCallback } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Network,
  Server,
  Database,
  User,
  MousePointerClick,
} from "lucide-react";
import type { ComponentType } from "@/lib/model-types";
import {
  isAwsType,
  AWS_SERVICE_MAP,
  AWS_CATEGORY_MAP,
} from "@/lib/aws-catalog";
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
}

const TypeConfig: Record<
  string,
  {
    icon: typeof Network;
    colorClass: string;
    borderClass: string;
    bgClass: string;
  }
> = {
  person: {
    icon: User,
    colorClass: "text-node-person",
    borderClass: "border-node-person/40",
    bgClass: "bg-node-person/5",
  },
  system: {
    icon: Network,
    colorClass: "text-node-system",
    borderClass: "border-node-system/40",
    bgClass: "bg-node-system/5",
  },
  container: {
    icon: Server,
    colorClass: "text-node-container",
    borderClass: "border-node-container/40",
    bgClass: "bg-node-container/5",
  },
  component: {
    icon: Database,
    colorClass: "text-node-component",
    borderClass: "border-node-component/40",
    bgClass: "bg-node-component/5",
  },
};

const awsCategoryColors: Record<
  string,
  { borderClass: string; bgClass: string; textClass: string }
> = {
  "aws-compute": {
    borderClass: "border-aws-compute/50",
    bgClass: "bg-aws-compute/8",
    textClass: "text-aws-compute",
  },
  "aws-storage": {
    borderClass: "border-aws-storage/50",
    bgClass: "bg-aws-storage/8",
    textClass: "text-aws-storage",
  },
  "aws-database": {
    borderClass: "border-aws-database/50",
    bgClass: "bg-aws-database/8",
    textClass: "text-aws-database",
  },
  "aws-networking": {
    borderClass: "border-aws-networking/50",
    bgClass: "bg-aws-networking/8",
    textClass: "text-aws-networking",
  },
  "aws-security": {
    borderClass: "border-aws-security/50",
    bgClass: "bg-aws-security/8",
    textClass: "text-aws-security",
  },
  "aws-analytics": {
    borderClass: "border-aws-analytics/50",
    bgClass: "bg-aws-analytics/8",
    textClass: "text-aws-analytics",
  },
  "aws-ml": {
    borderClass: "border-aws-ml/50",
    bgClass: "bg-aws-ml/8",
    textClass: "text-aws-ml",
  },
  "aws-integration": {
    borderClass: "border-aws-integration/50",
    bgClass: "bg-aws-integration/8",
    textClass: "text-aws-integration",
  },
  "aws-management": {
    borderClass: "border-aws-management/50",
    bgClass: "bg-aws-management/8",
    textClass: "text-aws-management",
  },
  "aws-developer": {
    borderClass: "border-aws-developer/50",
    bgClass: "bg-aws-developer/8",
    textClass: "text-aws-developer",
  },
  "aws-containers": {
    borderClass: "border-aws-containers/50",
    bgClass: "bg-aws-containers/8",
    textClass: "text-aws-containers",
  },
  "aws-media": {
    borderClass: "border-aws-media/50",
    bgClass: "bg-aws-media/8",
    textClass: "text-aws-media",
  },
  "aws-migration": {
    borderClass: "border-aws-migration/50",
    bgClass: "bg-aws-migration/8",
    textClass: "text-aws-migration",
  },
  "aws-iot": {
    borderClass: "border-aws-iot/50",
    bgClass: "bg-aws-iot/8",
    textClass: "text-aws-iot",
  },
  "aws-end-user": {
    borderClass: "border-aws-end-user/50",
    bgClass: "bg-aws-end-user/8",
    textClass: "text-aws-end-user",
  },
  "aws-general": {
    borderClass: "border-aws-general/50",
    bgClass: "bg-aws-general/8",
    textClass: "text-aws-general",
  },
};

const handleStyle = "!bg-muted-foreground !border-background !w-2.5 !h-2.5";

const Node = memo(({ data }: NodeProps) => {
  const d = data as unknown as NodeData;
  const isAws = isAwsType(d.type);
  const canDrillDown = useCanNavigateInto(d.elementId);

  const handleDrillDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      d.onDrillDown(d.elementId);
    },
    [d],
  );

  if (isAws) {
    const awsColors =
      awsCategoryColors[d.type] ?? awsCategoryColors["aws-general"];
    const svcInfo = d.awsService ? AWS_SERVICE_MAP.get(d.awsService) : null;
    const catInfo = AWS_CATEGORY_MAP.get(d.type);
    const iconName = svcInfo?.iconName;
    const categoryLabel = catInfo?.name ?? d.type;

    return (
      <div
        className={`relative rounded-xl border-2 ${awsColors.borderClass} ${awsColors.bgClass} backdrop-blur-sm min-w-[180px] max-w-[260px] transition-shadow duration-200 ${
          d.isSelected ? "ring-2 ring-primary shadow-lg shadow-primary/10" : ""
        }`}
      >
        {/* Input — left */}
        <Handle
          type="target"
          position={Position.Left}
          className={handleStyle}
        />

        <div className="px-4 py-3">
          <div className="flex items-center gap-2.5 mb-2">
            {iconName ? (
              <AwsIcon iconName={iconName} size={28} />
            ) : (
              <div
                className={`flex items-center justify-center w-7 h-7 rounded bg-secondary ${awsColors.textClass}`}
              >
                <Network className="h-4 w-4" />
              </div>
            )}
            <span
              className={`text-[9px] font-mono uppercase tracking-wider ${awsColors.textClass}`}
            >
              {categoryLabel}
            </span>
          </div>

          <h4 className="text-sm font-semibold text-foreground leading-tight mb-1">
            {d.name}
          </h4>

          {d.description && (
            <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
              {d.description}
            </p>
          )}

          {(d.technology || svcInfo) && (
            <span className="inline-block mt-2 text-[10px] font-mono rounded bg-secondary px-2 py-0.5 text-secondary-foreground">
              {d.technology ?? svcInfo?.name}
            </span>
          )}

          {canDrillDown && (
            <button
              onClick={handleDrillDown}
              className={`mt-2 flex items-center gap-1 text-[10px] font-medium ${awsColors.textClass} hover:underline`}
            >
              <MousePointerClick className="h-3 w-3" />
              Explorar interior
            </button>
          )}
        </div>

        {/* Output — right */}
        <Handle
          type="source"
          position={Position.Right}
          className={handleStyle}
        />
      </div>
    );
  }

  // Standard node
  const cfg = TypeConfig[d.type] ?? TypeConfig.system;
  const Icon = cfg.icon;

  return (
    <div
      className={`relative rounded-xl border-2 ${cfg.borderClass} ${cfg.bgClass} backdrop-blur-sm min-w-[180px] max-w-[240px] transition-shadow duration-200 ${
        d.isSelected ? "ring-2 ring-primary shadow-lg shadow-primary/10" : ""
      }`}
    >
      {/* Input — left */}
      <Handle type="target" position={Position.Left} className={handleStyle} />

      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-1.5">
          <Icon className={`h-4 w-4 ${cfg.colorClass} shrink-0`} />
          <span
            className={`text-[10px] font-mono uppercase tracking-wider ${cfg.colorClass}`}
          >
            {d.type}
          </span>
        </div>

        <h4 className="text-sm font-semibold text-foreground leading-tight mb-1">
          {d.name}
        </h4>

        {d.description && (
          <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
            {d.description}
          </p>
        )}

        {d.technology && (
          <span className="inline-block mt-2 text-[10px] font-mono rounded bg-secondary px-2 py-0.5 text-secondary-foreground">
            {d.technology}
          </span>
        )}

        {canDrillDown && (
          <button
            onClick={handleDrillDown}
            className={`mt-2 flex items-center gap-1 text-[10px] font-medium ${cfg.colorClass} hover:underline`}
          >
            <MousePointerClick className="h-3 w-3" />
            Explorar interior
          </button>
        )}
      </div>

      {/* Output — right */}
      <Handle type="source" position={Position.Right} className={handleStyle} />
    </div>
  );
});

Node.displayName = "Node";

export default Node;
