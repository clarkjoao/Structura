import { memo, type CSSProperties } from "react";
import { Handle, NodeResizer, Position, type Node, type NodeProps } from "@xyflow/react";
import type { FlowNodeShape } from "@/features/diagram";
import { useHandleHighlight } from "../../contexts/HandleHighlightContext";
import type { ProcessNodeData } from "./ProcessNode.types";

const HANDLE_CLASS = "!w-2.5 !h-2.5 !border-2 !border-background !bg-muted-foreground";

const CARD_BG = "hsl(var(--card))";
const BORDER = "hsl(var(--border))";
const PRIMARY = "hsl(var(--primary))";
const CLIP_SHADOW = "inset 0 0 0 1.5px hsl(var(--border)), 0 1px 3px 0 hsl(var(--foreground)/0.06)";
const CLIP_SHADOW_ACTIVE = `inset 0 0 0 2px ${PRIMARY}`;

const DIAMOND_CLIP = "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)";
const HEXAGON_CLIP = "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)";
const PARALLELOGRAM_CLIP = "polygon(12% 0%, 100% 0%, 88% 100%, 0% 100%)";

function labelPadding(shape: FlowNodeShape): string {
  switch (shape) {
    case "diamond":
      return "px-6 py-4";
    case "hexagon":
      return "px-5 py-2";
    case "parallelogram":
      return "px-6 py-2";
    case "cylinder":
      return "px-3 py-5";
    default:
      return "px-3 py-2";
  }
}

function cssShapeOutline(isActive: boolean): CSSProperties | undefined {
  return isActive ? { outline: `2px solid ${PRIMARY}`, outlineOffset: "2px" } : undefined;
}

interface ClipShapeLayerProps {
  clipPath: string;
  isActive: boolean;
  background?: string;
}

function ClipShapeLayer({ clipPath, isActive, background = CARD_BG }: ClipShapeLayerProps) {
  return (
    <>
      <div
        className="absolute inset-0 shadow-sm"
        style={{
          clipPath,
          background,
          boxShadow: CLIP_SHADOW,
        }}
      />
      {isActive && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            clipPath,
            boxShadow: CLIP_SHADOW_ACTIVE,
          }}
        />
      )}
    </>
  );
}

interface FlowShapeLayerProps {
  shape: FlowNodeShape;
  isActive: boolean;
  nodeColor?: string;
}

function FlowShapeLayer({ shape, isActive, nodeColor }: FlowShapeLayerProps) {
  const fill = nodeColor ?? CARD_BG;
  const strokeWidth = isActive ? 2.5 : 1.5;
  const stroke = isActive ? PRIMARY : BORDER;

  switch (shape) {
    case "rectangle":
      return (
        <div
          className="absolute inset-0 w-full h-full bg-card border border-border rounded-[3px] shadow-sm"
          style={{ ...cssShapeOutline(isActive), background: fill }}
        />
      );
    case "rounded":
      return (
        <div
          className="absolute inset-0 w-full h-full bg-card border border-border rounded-2xl shadow-sm"
          style={{ ...cssShapeOutline(isActive), background: fill }}
        />
      );
    case "stadium":
      return (
        <div
          className="absolute inset-0 w-full h-full bg-card border border-border rounded-full shadow-sm"
          style={{ ...cssShapeOutline(isActive), background: fill }}
        />
      );
    case "circle":
      return (
        <div
          className="absolute inset-0 w-full h-full bg-card border border-border rounded-full shadow-sm"
          style={{ ...cssShapeOutline(isActive), background: fill }}
        />
      );
    case "subroutine":
      return (
        <div
          className="absolute inset-0 w-full h-full bg-card border border-border rounded-[3px] shadow-sm"
          style={{ ...cssShapeOutline(isActive), background: fill }}
        >
          <div className="absolute inset-[5px] border border-border/50 rounded-[2px] pointer-events-none" />
        </div>
      );
    case "diamond":
      return <ClipShapeLayer clipPath={DIAMOND_CLIP} isActive={isActive} background={fill} />;
    case "hexagon":
      return <ClipShapeLayer clipPath={HEXAGON_CLIP} isActive={isActive} background={fill} />;
    case "parallelogram":
      return <ClipShapeLayer clipPath={PARALLELOGRAM_CLIP} isActive={isActive} background={fill} />;
    case "cylinder":
      return (
        <svg
          className="absolute inset-0 h-full w-full overflow-visible drop-shadow-sm"
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
        >
          <rect x="1" y="12" width="98" height="76" fill={fill} stroke="none" />
          <line x1="1" y1="12" x2="1" y2="88" stroke={stroke} strokeWidth={strokeWidth} />
          <line x1="99" y1="12" x2="99" y2="88" stroke={stroke} strokeWidth={strokeWidth} />
          <ellipse
            cx="50"
            cy="88"
            rx="49"
            ry="11"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
          <ellipse
            cx="50"
            cy="12"
            rx="49"
            ry="11"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        </svg>
      );
    default: {
      const _exhaustive: never = shape;
      return _exhaustive;
    }
  }
}

function FourSideHandles() {
  return (
    <>
      <Handle
        id="target-0"
        type="target"
        position={Position.Left}
        style={{ top: "35%" }}
        className={HANDLE_CLASS}
      />
      <Handle
        id="source-0"
        type="source"
        position={Position.Left}
        style={{ top: "65%" }}
        className={HANDLE_CLASS}
      />
      <Handle
        id="target-1"
        type="target"
        position={Position.Right}
        style={{ top: "35%" }}
        className={HANDLE_CLASS}
      />
      <Handle
        id="source-1"
        type="source"
        position={Position.Right}
        style={{ top: "65%" }}
        className={HANDLE_CLASS}
      />
      <Handle
        id="target-2"
        type="target"
        position={Position.Top}
        style={{ left: "35%" }}
        className={HANDLE_CLASS}
      />
      <Handle
        id="source-2"
        type="source"
        position={Position.Top}
        style={{ left: "65%" }}
        className={HANDLE_CLASS}
      />
      <Handle
        id="target-3"
        type="target"
        position={Position.Bottom}
        style={{ left: "35%" }}
        className={HANDLE_CLASS}
      />
      <Handle
        id="source-3"
        type="source"
        position={Position.Bottom}
        style={{ left: "65%" }}
        className={HANDLE_CLASS}
      />
    </>
  );
}

const ProcessNode = memo(({ data: d, selected }: NodeProps<Node<ProcessNodeData>>) => {
  const { highlightedNodeIds } = useHandleHighlight();
  const isSelected = selected || d.isSelected;
  const isHighlighted = highlightedNodeIds.has(d.elementId);
  const isActive = isSelected || isHighlighted;

  return (
    <>
      <NodeResizer
        minWidth={60}
        minHeight={60}
        isVisible={isSelected}
        keepAspectRatio={d.flowShape === "circle"}
        lineClassName="!border-transparent"
        handleClassName="!w-2 !h-2 !bg-foreground/40 !border-background !rounded-sm"
      />
      <FourSideHandles />
      <div className="relative h-full w-full">
        <FlowShapeLayer shape={d.flowShape} isActive={isActive} nodeColor={d.nodeColor} />
        <div
          className={`absolute inset-0 flex items-center justify-center pointer-events-none ${labelPadding(d.flowShape)}`}
        >
          <span className="max-w-full select-none text-center text-[11px] font-medium leading-snug text-foreground line-clamp-3 break-words">
            {d.name}
          </span>
        </div>
      </div>
    </>
  );
});

ProcessNode.displayName = "ProcessNode";

export default ProcessNode;
