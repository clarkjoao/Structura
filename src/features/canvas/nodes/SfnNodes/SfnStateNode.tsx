import { memo } from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import {
  Archive,
  ArrowRight,
  BellRing,
  Boxes,
  Clock,
  Cog,
  Container,
  Database,
  Inbox,
  Mail,
  Radio,
  Sparkles,
  SquareFunction,
  Waypoints,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type { SfnStateType } from "@/features/diagram/model/component.types";
import { useSkinPalette, type SkinNodeData } from "../VsmNodes/skin";
import { ELEMENT_SIZE_LIMITS } from "../elementSizeLimits";
import { DeployHandles } from "../DeployNodes/DeployParts";

export type SfnStateNodeData = SkinNodeData & {
  stateType: SfnStateType;
  service?: string;
  /** "Lambda · Invoke", "wait 30s"… */
  caption?: string;
  defaultAccent: string;
  incomingCount: number;
  outgoingCount: number;
};

/** A Task's glyph by its integrated service; a stand-in for one we do not know. */
const SERVICE_ICONS: Readonly<Record<string, LucideIcon>> = {
  lambda: SquareFunction,
  dynamodb: Database,
  sqs: Inbox,
  sns: BellRing,
  ecs: Container,
  ses: Mail,
  s3: Archive,
  glue: Boxes,
  eventbridge: Radio,
  bedrock: Sparkles,
  apigateway: Waypoints,
  stepfunctions: Workflow,
};

function iconFor(stateType: SfnStateType, service?: string): LucideIcon {
  if (stateType === "Wait") return Clock;
  if (stateType === "Pass") return ArrowRight;
  return (service && SERVICE_ICONS[service]) || Cog;
}

/**
 * A Task, Wait or Pass state: a 220×64 card with the pink bar, the service's
 * glyph (a clock for Wait, an arrow for Pass), the name and a mono caption.
 */
const SfnStateNode = memo(({ data: d, selected }: NodeProps<Node<SfnStateNodeData>>) => {
  const palette = useSkinPalette(d, d.laneAccent ?? d.defaultAccent);
  const isSelected = !!(selected || d.isSelected);
  const Icon = iconFor(d.stateType, d.service);
  return (
    <>
      <NodeResizer
        {...ELEMENT_SIZE_LIMITS["sfn-state"]}
        isVisible={isSelected}
        lineClassName="!border-transparent"
        handleClassName="!w-2 !h-2 !bg-foreground/40 !border-background !rounded-sm"
      />
      <DeployHandles
        elementId={d.elementId}
        incomingCount={d.incomingCount}
        outgoingCount={d.outgoingCount}
      />
      <div
        className={`relative flex h-full w-full items-center gap-2 rounded-lg px-3 shadow-sm ${
          isSelected ? "ring-2 ring-primary" : ""
        }`}
        style={{
          background: palette.surface,
          border: `1px ${palette.borderStyle} ${palette.border}`,
          borderLeft: `3px solid ${palette.accent}`,
        }}
      >
        <Icon size={16} strokeWidth={1.75} color={palette.icon} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p
            className="select-none truncate text-sm font-semibold"
            style={{ color: palette.title }}
          >
            {d.name}
          </p>
          {d.caption && (
            <p
              className="select-none truncate font-mono text-[11px]"
              style={{ color: palette.muted }}
            >
              {d.caption}
            </p>
          )}
        </div>
      </div>
    </>
  );
});
SfnStateNode.displayName = "SfnStateNode";

export default SfnStateNode;
