import { memo } from "react";
import { NodeResizer, type NodeProps } from "@xyflow/react";
import { Square } from "lucide-react";

export interface PanelNodeData {
  elementId: string;
  name: string;
  isSelected: boolean;
}

const PanelNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as PanelNodeData;

  return (
    <>
      <NodeResizer
        minWidth={200}
        minHeight={150}
        isVisible={selected || d.isSelected}
        lineClassName="!border-primary/40"
        handleClassName="!w-2.5 !h-2.5 !bg-primary !border-background !rounded-sm"
      />
      <div className="w-full h-full rounded-xl border border-dashed border-border/40 bg-card/5">
        <div className="flex items-center gap-1.5 px-3 py-2">
          <Square className="h-3 w-3 text-muted-foreground/60 shrink-0" />
          <span className="text-xs font-mono text-muted-foreground truncate">
            {d.name}
          </span>
        </div>
      </div>
    </>
  );
});

PanelNode.displayName = "PanelNode";

export default PanelNode;
