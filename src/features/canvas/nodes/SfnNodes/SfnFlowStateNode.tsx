import { memo } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import { X } from "lucide-react";
import type { FlowNodeShape } from "@/features/diagram";
import ProcessNode from "../ProcessNode";
import type { ProcessNodeData } from "../ProcessNode/ProcessNode.types";

export type SfnFlowStateNodeData = ProcessNodeData & {
  /** A Fail state carries an x over its end circle. */
  failed: boolean;
};

export type SfnFlowShape = Extract<FlowNodeShape, "diamond" | "start" | "end">;

/**
 * Choice, Succeed, Fail and the Start marker are the flowchart's own shapes —
 * the decision, the end and the start — drawn by the flow node itself with
 * the state's accent as the default one.
 */
const SfnFlowStateNode = memo((props: NodeProps<Node<SfnFlowStateNodeData>>) => (
  <>
    <ProcessNode {...(props as unknown as NodeProps<Node<ProcessNodeData>>)} />
    {props.data.failed && (
      // Over the end's filled stop square, in the card's colour so it reads on the red.
      <X
        size={14}
        strokeWidth={3}
        color="hsl(var(--card))"
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        aria-hidden
      />
    )}
  </>
));
SfnFlowStateNode.displayName = "SfnFlowStateNode";

export default SfnFlowStateNode;
