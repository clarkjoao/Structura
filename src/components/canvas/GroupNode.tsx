import { memo } from "react";
import { Handle, Position, NodeResizer, type NodeProps } from "@xyflow/react";
import { Network, Server, User } from "lucide-react";
import type { ComponentType } from "@/lib/model-types";
import { isAwsType, AWS_CATEGORY_MAP } from "@/lib/aws-catalog";

export interface GroupNodeData {
  elementId: string;
  name: string;
  type: ComponentType;
  description: string;
  technology?: string;
  isSelected: boolean;
}

const typeLabels: Record<string, string> = {
  system: "Software System",
  container: "Container",
  person: "Person",
};

const typeIcons: Record<string, typeof Network> = {
  system: Network,
  container: Server,
  person: User,
};

const typeBorderColor: Record<string, string> = {
  system: "border-node-system/30",
  container: "border-node-container/30",
  person: "border-node-person/30",
};

const typeHeaderBg: Record<string, string> = {
  system: "bg-node-system/10",
  container: "bg-node-container/10",
  person: "bg-node-person/10",
};

const typeTextColor: Record<string, string> = {
  system: "text-node-system",
  container: "text-node-container",
  person: "text-node-person",
};

const handleStyle = "!bg-muted-foreground !border-background !w-2.5 !h-2.5";

const GroupNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as GroupNodeData;
  const isAws = isAwsType(d.type);

  const borderClass = isAws
    ? "border-aws-general/30"
    : typeBorderColor[d.type] ?? typeBorderColor.system;
  const headerBg = isAws
    ? "bg-aws-general/10"
    : typeHeaderBg[d.type] ?? typeHeaderBg.system;
  const textColor = isAws
    ? "text-aws-general"
    : typeTextColor[d.type] ?? typeTextColor.system;

  const Icon = typeIcons[d.type] ?? Network;
  const label = isAws
    ? AWS_CATEGORY_MAP.get(d.type)?.name ?? d.type
    : typeLabels[d.type] ?? d.type;

  return (
    <>
      <NodeResizer
        minWidth={280}
        minHeight={200}
        isVisible={selected || d.isSelected}
        lineClassName="!border-primary/40"
        handleClassName="!w-2.5 !h-2.5 !bg-primary !border-background !rounded-sm"
      />

      <Handle type="target" position={Position.Left} className={handleStyle} />

      <div
        className={`w-full h-full rounded-xl border-2 border-dashed ${borderClass} bg-card/30 backdrop-blur-[2px] overflow-visible`}
      >
        {/* Header */}
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-t-[10px] ${headerBg}`}
        >
          <Icon className={`h-3.5 w-3.5 ${textColor} shrink-0`} />
          <span className="text-xs font-semibold text-foreground truncate">
            {d.name}
          </span>
          <span
            className={`text-[9px] font-mono uppercase tracking-wider ${textColor} ml-auto shrink-0`}
          >
            [{label}]
          </span>
        </div>

        {d.description && (
          <p className="px-3 pt-1 text-[10px] text-muted-foreground line-clamp-1">
            {d.description}
          </p>
        )}

        {d.technology && (
          <span className="inline-block mx-3 mt-1 text-[9px] font-mono rounded bg-secondary px-1.5 py-0.5 text-secondary-foreground">
            {d.technology}
          </span>
        )}
      </div>

      <Handle type="source" position={Position.Right} className={handleStyle} />
    </>
  );
});

GroupNode.displayName = "GroupNode";

export default GroupNode;
