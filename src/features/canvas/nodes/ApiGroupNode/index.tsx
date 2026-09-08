import { memo } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import { Play, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ApiProtocol, FlowRef } from "@/features/diagram";
import { HEADER_H, FOOTER_H, PROTOCOL_COLORS } from "./constants";
import { CompareSceneBadges, SceneElementBadge } from "../SceneElementBadge";
import { useCollabHighlight } from "@/features/collaboration";

export { PROTOCOL_COLORS } from "./constants";

export type ApiGroupNodeData = {
  elementId: string;
  serviceName: string;
  basePath: string;
  protocol: ApiProtocol;
  sla?: string;
  customColor?: string;
  isSelected: boolean;
  controlsDisabled?: boolean;
  onAddEndpoint?: () => void;
  /** Every script running through one of this group's routes, named once. */
  flows?: FlowRef[];
  onPlayFlow?: (flowId: string) => void;
  sceneBadge?: { name: string; color: string };
  compareBadges?: {
    a: { name: string; color: string };
    b: { name: string; color: string };
  };
};

const ApiGroupNode = memo(({ data: d, selected }: NodeProps<Node<ApiGroupNodeData>>) => {
  const { t } = useTranslation();
  const isSelected = selected || d.isSelected;
  const collabHighlight = useCollabHighlight(d.elementId);
  const flows = d.flows ?? [];

  return (
    <div
      className={`w-full h-full rounded-xl border-2 relative overflow-hidden transition-all duration-200 ${
        isSelected
          ? "border-primary ring-2 ring-primary/20"
          : "border-border bg-card/40 backdrop-blur-sm"
      }`}
      style={{ borderColor: isSelected ? undefined : `${PROTOCOL_COLORS[d.protocol]}66` }}
    >
      {collabHighlight && (
        <div
          className="absolute inset-0 pointer-events-none rounded-xl z-10"
          style={{ boxShadow: `inset 0 0 0 2px ${collabHighlight.color}` }}
        />
      )}
      {d.compareBadges && <CompareSceneBadges a={d.compareBadges.a} b={d.compareBadges.b} />}
      {!d.compareBadges && d.sceneBadge && (
        <SceneElementBadge name={d.sceneBadge.name} color={d.sceneBadge.color} />
      )}
      <div
        style={{ height: HEADER_H }}
        className="px-3 py-2.5 border-b border-border bg-card/80 rounded-t-xl flex flex-col justify-center"
      >
        <div className="flex items-center gap-2">
          {d.customColor && (
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: d.customColor }}
            />
          )}
          <span
            className="text-[10px] font-bold rounded px-1.5 py-0.5 text-white shrink-0"
            style={{ backgroundColor: PROTOCOL_COLORS[d.protocol] }}
          >
            {d.protocol}
          </span>
          <span className="text-xs font-mono font-semibold text-foreground truncate flex-1">
            {d.basePath}
          </span>
          {d.sla && (
            <span className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5 shrink-0">
              {d.sla}
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{d.serviceName}</p>
      </div>

      {/*
        One strip, two states. Where a route can be added — the editor — it is
        the button that adds one. Where it cannot, it used to render empty, and
        that is the mode with the most to say: which scripts run through here.
      */}
      <div
        className="absolute bottom-0 left-0 right-0 border-t border-border"
        style={{ height: FOOTER_H }}
      >
        {!d.controlsDisabled ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              d.onAddEndpoint?.();
            }}
            className="w-full h-full flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors rounded-b-xl"
          >
            <Plus className="h-3.5 w-3.5" /> {t("apiGroup.addEndpoint")}
          </button>
        ) : (
          flows.length > 0 && (
            <div
              data-testid="api-group-scripts"
              className="flex h-full items-center gap-1 overflow-x-auto px-2"
            >
              {flows.map((flow) => (
                <button
                  key={flow.id}
                  type="button"
                  title={t("apiGroup.playScript", { names: flow.name })}
                  onClick={(e) => {
                    e.stopPropagation();
                    d.onPlayFlow?.(flow.id);
                  }}
                  className="flow-play-control inline-flex shrink-0 items-center gap-1 rounded border border-border bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-surface-hover"
                >
                  <Play className="h-2.5 w-2.5 shrink-0 text-primary" />
                  <span className="max-w-[12rem] truncate">{flow.name}</span>
                </button>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
});

ApiGroupNode.displayName = "ApiGroupNode";

export default ApiGroupNode;
