import { memo, useCallback } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Network, Server, Database, User, Link2, LayoutDashboard, MousePointerClick, Eye } from "lucide-react";
import type { ComponentType } from "@/lib/model-types";
import { isAwsType, AWS_SERVICE_MAP, AWS_CATEGORY_MAP } from "@/lib/aws-catalog";
import AwsIcon from "./AwsIcon";

export interface NodeData {
  elementId: string;
  name: string;
  type: ComponentType;
  description: string;
  technology?: string;
  awsService?: string;
  isSelected: boolean;
  serviceName?: string;
  linkedDiagramName?: string;
  onDrillDown?: (elementId: string) => void;
  onEmbed?: (elementId: string) => void;
  recordingBadges?: number[];
  isLastRecorded?: boolean;
  isRecording?: boolean;
  onHandleClick?: (nodeId: string, handleId: string) => void;
  lastRecordedHandleId?: string;
  activeHandleId?: string;
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

function getHandleClass(d: NodeData, handleId: string): string {
  const base = "!border-background";
  const isRecHighlighted = d.isRecording && d.lastRecordedHandleId === handleId;
  const isPlayHighlighted = !d.isRecording && d.activeHandleId === handleId;

  if (isRecHighlighted) {
    return `${base} !w-3.5 !h-3.5 !bg-primary ring-2 ring-primary`;
  }
  if (isPlayHighlighted) {
    return `${base} !w-3.5 !h-3.5 !bg-primary ring-2 ring-primary animate-pulse`;
  }
  if (d.isRecording) {
    return `${base} !w-3.5 !h-3.5 !bg-primary/60 cursor-pointer hover:!bg-primary hover:ring-2 hover:ring-primary transition-all`;
  }
  return `${base} !w-2.5 !h-2.5 !bg-muted-foreground`;
}

const Badges = ({ serviceName, linkedDiagramName }: { serviceName?: string; linkedDiagramName?: string }) => (
  <>
    {serviceName && (
      <div className="flex items-center gap-1 mt-1.5">
        <Link2 className="h-3 w-3 text-primary shrink-0" />
        <span className="text-[10px] text-primary truncate">{serviceName}</span>
      </div>
    )}
    {linkedDiagramName && (
      <div className="flex items-center gap-1 mt-1">
        <LayoutDashboard className="h-3 w-3 text-node-container shrink-0" />
        <span className="text-[10px] text-node-container truncate">{linkedDiagramName}</span>
      </div>
    )}
  </>
);

const DrillDownButton = ({ elementId, onDrillDown, colorClass }: { elementId: string; onDrillDown?: (id: string) => void; colorClass: string }) => {
  const handleClick = useCallback((e: React.MouseEvent) => { e.stopPropagation(); onDrillDown?.(elementId); }, [elementId, onDrillDown]);
  if (!onDrillDown) return null;
  return (
    <button onClick={handleClick} className={`mt-2 flex items-center gap-1 text-[10px] font-medium ${colorClass} hover:underline`}>
      <MousePointerClick className="h-3 w-3" /> Explorar interior
    </button>
  );
};

const EmbedButton = ({ elementId, onEmbed }: { elementId: string; onEmbed?: (id: string) => void }) => {
  const handleClick = useCallback((e: React.MouseEvent) => { e.stopPropagation(); onEmbed?.(elementId); }, [elementId, onEmbed]);
  if (!onEmbed) return null;
  return (
    <button onClick={handleClick} className="mt-1 flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:underline">
      <Eye className="h-3 w-3" /> Incorporar diagrama
    </button>
  );
};

const CardNode = memo(({ data }: NodeProps) => {
  const d = data as unknown as NodeData;
  const isAws = isAwsType(d.type);
  const hasDrillDown = !!d.linkedDiagramName && !!d.onDrillDown;
  const hasEmbed = !!d.linkedDiagramName && !!d.onEmbed;

  const forcePointer = d.isRecording || !!d.activeHandleId;

  const onLeftClick = (e: React.MouseEvent) => {
    if (d.isRecording && d.onHandleClick) { e.stopPropagation(); d.onHandleClick(d.elementId, "left"); }
  };

  const onRightClick = (e: React.MouseEvent) => {
    if (d.isRecording && d.onHandleClick) { e.stopPropagation(); d.onHandleClick(d.elementId, "right"); }
  };

  const leftClass = getHandleClass(d, "left");
  const rightClass = getHandleClass(d, "right");
  const handlePointer = forcePointer ? { pointerEvents: "all" as const } : undefined;

  if (isAws) {
    const svcInfo = d.awsService ? AWS_SERVICE_MAP.get(d.awsService) : null;
    const catInfo = AWS_CATEGORY_MAP.get(d.type);
    const borderClass = awsCategoryBorders[d.type] ?? "border-l-aws-general";
    return (
      <div className={`relative min-w-[200px] max-w-[260px] rounded-lg bg-card border border-border ${borderClass} border-l-[3px] transition-shadow duration-200 ${d.isSelected ? "ring-2 ring-primary shadow-lg shadow-primary/10" : ""}`}>
        {d.recordingBadges && d.recordingBadges.length > 0 && (
          <div className={`absolute -top-2.5 -right-2.5 z-10 flex items-center justify-center min-w-[20px] h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-1 ${d.isLastRecorded ? "animate-pulse" : ""}`}>
            {d.recordingBadges.join(",")}
          </div>
        )}
        <Handle type="target" position={Position.Left} className={leftClass} style={handlePointer} onClick={d.isRecording ? onLeftClick : undefined} />
        <div className="px-3 py-2.5">
          <div className="flex items-center gap-2 mb-1.5">
            {svcInfo?.iconName ? <AwsIcon iconName={svcInfo.iconName} size={20} /> : <Network className="h-4 w-4 text-muted-foreground" />}
            <span className="text-sm font-bold text-foreground leading-tight truncate">{d.name}</span>
          </div>
          {d.description && <p className="text-xs text-muted-foreground leading-snug line-clamp-2 mb-1.5">{d.description}</p>}
          {(d.technology || svcInfo) && <span className="inline-block text-[10px] font-mono rounded bg-secondary px-1.5 py-0.5 text-secondary-foreground">{d.technology ?? catInfo?.name ?? svcInfo?.name}</span>}
          <Badges serviceName={d.serviceName} linkedDiagramName={d.linkedDiagramName} />
          {hasDrillDown && <DrillDownButton elementId={d.elementId} onDrillDown={d.onDrillDown} colorClass="text-primary" />}
          {hasEmbed && <EmbedButton elementId={d.elementId} onEmbed={d.onEmbed} />}
        </div>
        <Handle type="source" position={Position.Right} className={rightClass} style={handlePointer} onClick={d.isRecording ? onRightClick : undefined} />
      </div>
    );
  }

  const cfg = TypeConfig[d.type] ?? TypeConfig.system;
  const Icon = cfg.icon;

  return (
    <div className={`relative min-w-[200px] max-w-[260px] rounded-lg bg-card border border-border ${cfg.borderColor} border-l-[3px] transition-shadow duration-200 ${d.isSelected ? "ring-2 ring-primary shadow-lg shadow-primary/10" : ""}`}>
      {d.recordingBadges && d.recordingBadges.length > 0 && (
        <div className={`absolute -top-2.5 -right-2.5 z-10 flex items-center justify-center min-w-[20px] h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-1 ${d.isLastRecorded ? "animate-pulse" : ""}`}>
          {d.recordingBadges.join(",")}
        </div>
      )}
      <Handle type="target" position={Position.Left} className={leftClass} style={handlePointer} onClick={d.isRecording ? onLeftClick : undefined} />
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2 mb-1.5">
          <Icon className={`h-4 w-4 ${cfg.textColor} shrink-0`} />
          <span className="text-sm font-bold text-foreground leading-tight truncate">{d.name}</span>
        </div>
        {d.description && <p className="text-xs text-muted-foreground leading-snug line-clamp-2 mb-1.5">{d.description}</p>}
        {d.technology && <span className="inline-block text-[10px] font-mono rounded bg-secondary px-1.5 py-0.5 text-secondary-foreground">{d.technology}</span>}
        <Badges serviceName={d.serviceName} linkedDiagramName={d.linkedDiagramName} />
        {hasDrillDown && <DrillDownButton elementId={d.elementId} onDrillDown={d.onDrillDown} colorClass={cfg.textColor} />}
        {hasEmbed && <EmbedButton elementId={d.elementId} onEmbed={d.onEmbed} />}
      </div>
      <Handle type="source" position={Position.Right} className={rightClass} style={handlePointer} onClick={d.isRecording ? onRightClick : undefined} />
    </div>
  );
});

CardNode.displayName = "CardNode";
export default CardNode;
