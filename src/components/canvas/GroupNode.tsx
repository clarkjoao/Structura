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

const typeIcons: Record<string, typeof Network> = {
  system: Network,
  container: Server,
  person: User,
};

const typeLabels: Record<string, string> = {
  system: "System",
  container: "Container",
  person: "Person",
};

const typeBorder: Record<string, string> = {
  system: "border-node-system/40",
  container: "border-node-container/40",
  person: "border-node-person/40",
};

const typeText: Record<string, string> = {
  system: "text-node-system",
  container: "text-node-container",
  person: "text-node-person",
};

const handleStyle = "!bg-muted-foreground !border-background !w-2.5 !h-2.5";

const GroupNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as GroupNodeData;
  const isAws = isAwsType(d.type);

  const border = isAws
    ? "border-aws-general/40"
    : typeBorder[d.type] ?? typeBorder.system;
  const textColor = isAws
    ? "text-aws-general"
    : typeText[d.type] ?? typeText.system;

  const Icon = typeIcons[d.type] ?? Network;
  const label = isAws
    ? AWS_CATEGORY_MAP.get(d.type)?.name ?? d.type
    : typeLabels[d.type] ?? d.type;

  return (
    <>
      <NodeResizer
        minWidth={400}
        minHeight={300}
        isVisible={selected || d.isSelected}
        lineClassName="!border-primary/40"
        handleClassName="!w-2.5 !h-2.5 !bg-primary !border-background !rounded-sm"
      />

      <Handle type="target" position={Position.Left} className={handleStyle} />

      <div
        className={`w-full h-full rounded-2xl border ${border} bg-card/5 backdrop-blur-[1px]`}
      >
        <div className="flex items-center gap-2 px-4 py-3">
          <Icon className={`h-4 w-4 ${textColor} shrink-0`} />
          <span className="text-sm font-semibold text-foreground truncate">
            {d.name}
          </span>
          <span
            className={`text-xs font-mono ${textColor} ml-1 shrink-0`}
          >
            {label}
          </span>
        </div>
      </div>

      <Handle type="source" position={Position.Right} className={handleStyle} />
    </>
  );
});

GroupNode.displayName = "GroupNode";

export default GroupNode;
