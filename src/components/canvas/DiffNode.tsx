import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Network, Server, Database, User, Plus, Minus, Pencil } from "lucide-react";
import type { C4ElementType } from "@/lib/model-types";
import type { DiffStatus } from "@/lib/model-diff";
import { isAwsType, AWS_SERVICE_MAP } from "@/lib/aws-catalog";
import AwsIcon from "./AwsIcon";

export interface DiffNodeData {
  name: string;
  type: C4ElementType;
  description: string;
  technology?: string;
  awsService?: string;
  diffStatus: DiffStatus;
  changes?: string[];
}

const typeIcons: Record<string, typeof Network> = {
  person: User,
  system: Network,
  container: Server,
  component: Database,
};

const diffStyles: Record<DiffStatus, { border: string; bg: string; badge: string; badgeIcon: typeof Plus | null; badgeText: string }> = {
  added:     { border: "border-success/60",      bg: "bg-success/8",      badge: "bg-success/15 text-success",      badgeIcon: Plus,   badgeText: "Adicionado" },
  removed:   { border: "border-destructive/60",   bg: "bg-destructive/8",  badge: "bg-destructive/15 text-destructive", badgeIcon: Minus,  badgeText: "Removido" },
  modified:  { border: "border-warning/60",       bg: "bg-warning/8",      badge: "bg-warning/15 text-warning",       badgeIcon: Pencil, badgeText: "Modificado" },
  unchanged: { border: "border-border",           bg: "bg-card",           badge: "",                                  badgeIcon: null,   badgeText: "" },
};

const DiffNode = memo(({ data }: NodeProps) => {
  const d = data as unknown as DiffNodeData;
  const style = diffStyles[d.diffStatus];
  const isAws = isAwsType(d.type);
  const svcInfo = d.awsService ? AWS_SERVICE_MAP.get(d.awsService) : null;

  return (
    <div
      className={`relative rounded-xl border-2 ${style.border} ${style.bg} backdrop-blur-sm min-w-[180px] max-w-[240px] transition-all ${
        d.diffStatus === "removed" ? "opacity-60" : ""
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground !border-background !w-2.5 !h-2.5" />

      <div className="px-4 py-3">
        {/* Diff badge */}
        {d.diffStatus !== "unchanged" && (
          <div className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-mono font-semibold mb-2 ${style.badge}`}>
            {style.badgeIcon && <style.badgeIcon className="h-2.5 w-2.5" />}
            {style.badgeText}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-2 mb-1.5">
          {isAws && svcInfo ? (
            <AwsIcon iconName={svcInfo.iconName} size={20} />
          ) : (
            (() => {
              const Icon = typeIcons[d.type] ?? Network;
              return <Icon className="h-4 w-4 text-muted-foreground shrink-0" />;
            })()
          )}
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            {isAws ? (svcInfo?.name ?? d.type) : d.type}
          </span>
        </div>

        {/* Name */}
        <h4 className={`text-sm font-semibold leading-tight mb-1 ${
          d.diffStatus === "removed" ? "line-through text-muted-foreground" : "text-foreground"
        }`}>
          {d.name}
        </h4>

        {d.description && (
          <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{d.description}</p>
        )}

        {d.technology && (
          <span className="inline-block mt-2 text-[10px] font-mono rounded bg-secondary px-2 py-0.5 text-secondary-foreground">
            {d.technology}
          </span>
        )}

        {d.changes && d.changes.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {d.changes.map((c) => (
              <span key={c} className="text-[9px] font-mono rounded bg-warning/10 text-warning px-1.5 py-0.5">
                {c}
              </span>
            ))}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground !border-background !w-2.5 !h-2.5" />
    </div>
  );
});

DiffNode.displayName = "DiffNode";

export default DiffNode;
