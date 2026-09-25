import { memo } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import { Workflow } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSkinPalette, type SkinNodeData } from "../VsmNodes/skin";
import { Chip } from "../DeployNodes/DeployParts";
import { K8sFrame } from "../DeployNodes/K8sParts";

export type SfnStateMachineNodeData = SkinNodeData & {
  workflowType: "Standard" | "Express";
  stateCount: number;
  xray: boolean;
  collapsed: boolean;
  defaultAccent: string;
  incomingCount: number;
  outgoingCount: number;
};

/**
 * A state machine: the container frame with the workflow glyph, "State
 * machine", and its chips — Standard or Express, how many states, X-Ray.
 * Compact, a "+" says the states are inside.
 */
const SfnStateMachineNode = memo(
  ({ data: d, selected }: NodeProps<Node<SfnStateMachineNodeData>>) => {
    const { t } = useTranslation();
    const palette = useSkinPalette(d, d.laneAccent ?? d.defaultAccent);
    return (
      <K8sFrame
        palette={palette}
        icon={<Workflow size={16} strokeWidth={1.75} color={palette.icon} className="shrink-0" />}
        name={d.name}
        caption={t("sfn.stateMachine")}
        chips={
          <>
            <Chip>{d.workflowType}</Chip>
            <Chip>{t("sfn.states", { count: d.stateCount })}</Chip>
            {d.xray && <Chip>X-Ray</Chip>}
          </>
        }
        dashed={false}
        collapsed={d.collapsed}
        isSelected={!!(selected || d.isSelected)}
        elementId={d.elementId}
        incomingCount={d.incomingCount}
        outgoingCount={d.outgoingCount}
        minWidth={280}
        drillDown
      />
    );
  },
);
SfnStateMachineNode.displayName = "SfnStateMachineNode";

export default SfnStateMachineNode;
