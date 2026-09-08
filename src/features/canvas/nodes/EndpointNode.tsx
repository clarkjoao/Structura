import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Play } from "lucide-react";
import type { EndpointHandler, FlowRef, HttpMethod } from "@/features/diagram";
import { ENDPOINT_H, METHOD_COLORS } from "./ApiGroupNode/constants";
import { CompareSceneBadges, SceneElementBadge } from "./SceneElementBadge";
import { useCollabHighlight } from "@/features/collaboration";

export { METHOD_COLORS } from "./ApiGroupNode/constants";

export type EndpointNodeData = {
  elementId: string;
  method: HttpMethod;
  path: string;
  description?: string;
  handlers: EndpointHandler[];
  /**
   * The scripts that call this route, by name.
   *
   * A route with none is as worth seeing as an unused component: the canvas
   * already says which flows touch a node, and this is the same fact for an
   * operation.
   */
  callerNames?: string[];
  /**
   * The scripts that run through this route — the ones its handlers implement
   * and the ones whose steps call it, in that order.
   */
  flows?: FlowRef[];
  isSelected: boolean;
  controlsDisabled?: boolean;
  isPlaying?: boolean;
  onPlayFlow?: (flowId: string) => void;
  sceneBadge?: { name: string; color: string };
  compareBadges?: {
    a: { name: string; color: string };
    b: { name: string; color: string };
  };
};

const EndpointNode = memo(({ data: d }: NodeProps<Node<EndpointNodeData>>) => {
  const { method, path } = d;
  const { t } = useTranslation();
  const collabHighlight = useCollabHighlight(d.elementId);
  const callers = d.callerNames ?? [];
  /**
   * One control, however many scripts run through the route. It plays the
   * first and names them all: the complete list, one click each, is the
   * group's own — a 40px row beside a method and a path is not a menu.
   */
  const flows = d.flows ?? [];
  const first = flows[0];

  return (
    <div
      className="relative w-full h-full flex items-center gap-2 px-3 border-b border-border/50 bg-card hover:bg-surface-hover transition-colors"
      style={{ height: ENDPOINT_H }}
    >
      {collabHighlight && (
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{ boxShadow: `inset 0 0 0 2px ${collabHighlight.color}` }}
        />
      )}
      {d.compareBadges && <CompareSceneBadges a={d.compareBadges.a} b={d.compareBadges.b} />}
      {!d.compareBadges && d.sceneBadge && (
        <SceneElementBadge name={d.sceneBadge.name} color={d.sceneBadge.color} />
      )}
      <Handle
        id="target-0"
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-muted-foreground !border-background"
      />

      <span
        className="text-[10px] font-bold rounded px-1.5 py-0.5 text-white shrink-0"
        style={{ backgroundColor: METHOD_COLORS[method] ?? "#888" }}
      >
        {method}
      </span>

      <span className="text-[11px] font-mono text-foreground truncate flex-1">{path}</span>

      {callers.length > 0 && (
        <span
          data-testid="endpoint-callers"
          title={t("apiGroup.calledByScripts", { names: callers.join(", ") })}
          className="shrink-0 rounded bg-secondary px-1 py-0.5 font-mono text-[9px] text-muted-foreground"
        >
          ↗ {callers.length}
        </span>
      )}

      {first && (
        <button
          type="button"
          data-testid="endpoint-play"
          title={t("apiGroup.playScript", { names: flows.map((flow) => flow.name).join(", ") })}
          onClick={(e) => {
            e.stopPropagation();
            d.onPlayFlow?.(first.id);
          }}
          className="flow-play-control shrink-0 flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
        >
          <Play className="h-2.5 w-2.5" />
          {flows.length > 1 && <span className="font-mono">{flows.length}</span>}
        </button>
      )}

      <Handle
        id="source-0"
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-muted-foreground !border-background"
      />
    </div>
  );
});

EndpointNode.displayName = "EndpointNode";

export default EndpointNode;
