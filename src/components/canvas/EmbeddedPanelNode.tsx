import { memo, useCallback } from "react";
import { type NodeProps } from "@xyflow/react";
import { Eye, X } from "lucide-react";

export interface EmbeddedPanelData {
  embedId: string;
  diagramName: string;
  onDetach: (embedId: string) => void;
}

const EmbeddedPanelNode = memo(({ data }: NodeProps) => {
  const d = data as unknown as EmbeddedPanelData;
  const handleDetach = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    d.onDetach(d.embedId);
  }, [d]);

  return (
    <div className="w-full h-full rounded-xl border border-dashed border-border/30 bg-card/3">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Eye className="h-3 w-3 text-muted-foreground/60 shrink-0" />
          <span className="text-xs font-mono text-muted-foreground truncate">
            {d.diagramName}
          </span>
          <span className="text-[9px] font-mono text-muted-foreground/50 rounded bg-secondary/50 px-1 py-0.5">
            read-only
          </span>
        </div>
        <button
          onClick={handleDetach}
          className="text-muted-foreground/60 hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
});

EmbeddedPanelNode.displayName = "EmbeddedPanelNode";

export default EmbeddedPanelNode;
