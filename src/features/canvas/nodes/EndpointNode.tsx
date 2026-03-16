import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Play } from "lucide-react";
import type { EndpointHandler, HttpMethod } from "@/features/diagram";

export const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: "hsl(152 60% 40%)",
  POST: "hsl(220 70% 50%)",
  PUT: "hsl(38 92% 50%)",
  PATCH: "hsl(270 70% 55%)",
  DELETE: "hsl(0 70% 50%)",
  EVENT: "hsl(187 72% 51%)",
};

export interface EndpointNodeData {
  elementId: string;
  method: HttpMethod;
  path: string;
  description?: string;
  handlers: EndpointHandler[];
  isSelected: boolean;
  controlsDisabled?: boolean;
  isPlaying?: boolean;
  activeFlowId?: string | null;
  onPlayHandler?: (flowId: string) => void;
  onStopPlay?: () => void;
  availableFlows?: { id: string; name: string }[];
}

const EndpointNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as EndpointNodeData;
  const isActive = selected || d.isSelected;
  const { method, path, description, handlers } = d;

  return (
    <>
      <Handle type="target" position={Position.Left} id="target-0" className="!w-2.5 !h-2.5 !bg-muted-foreground !border-background" />
      <Handle type="source" position={Position.Right} id="source-0" className="!w-2.5 !h-2.5 !bg-muted-foreground !border-background" />
      <div
        className={`min-w-[240px] max-w-[320px] rounded-lg border border-border bg-card overflow-hidden transition-shadow ${
          isActive ? "ring-2 ring-primary shadow-[0_0_0_2px_hsl(var(--primary)/0.3)]" : "shadow-md hover:shadow-lg"
        }`}
      >
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
          <span
            className="text-[10px] font-bold rounded px-1.5 py-0.5 text-white shrink-0"
            style={{ backgroundColor: METHOD_COLORS[method] }}
          >
            {method}
          </span>
          <span className="text-xs font-mono text-foreground font-semibold truncate">{path}</span>
        </div>
        {description?.trim() ? (
          <div className="px-3 py-1.5 border-b border-border/50">
            <span className="text-xs text-muted-foreground line-clamp-2">{description}</span>
          </div>
        ) : null}
        <div className="divide-y divide-border/50">
          {(d.handlers ?? []).map((handler, index) => (
            <div
              key={handler.id}
              className="flex items-center gap-2 px-3 py-2 border-border/50 last:border-0 group/handler"
            >
              <span className="text-[10px] font-mono text-muted-foreground w-4 shrink-0">
                {index + 1}.
              </span>
              <span className="text-xs text-foreground flex-1 truncate">{handler.label}</span>
              {handler.flowId && !d.controlsDisabled ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    d.onPlayHandler?.(handler.flowId!);
                  }}
                  className={`shrink-0 flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                    d.activeFlowId === handler.flowId
                      ? "bg-primary text-primary-foreground animate-pulse"
                      : "bg-primary/10 text-primary hover:bg-primary/20"
                  }`}
                  title="Iniciar flow"
                >
                  <Play className="h-2.5 w-2.5" />
                  {d.availableFlows?.find((f) => f.id === handler.flowId)?.name ?? "Flow"}
                </button>
              ) : handler.flowId ? (
                <span className="shrink-0 text-[10px] text-muted-foreground bg-secondary rounded px-1.5 py-0.5">
                  flow
                </span>
              ) : (
                <span className="shrink-0 text-[10px] text-muted-foreground/40 italic">
                  sem flow
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
});

EndpointNode.displayName = "EndpointNode";

export default EndpointNode;
