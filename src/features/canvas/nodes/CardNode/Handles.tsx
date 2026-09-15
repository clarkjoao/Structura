import { Handle, Position } from "@xyflow/react";
import type { NodeData } from "./types";
import { MIN_HANDLES, MAX_HANDLES } from "../../canvas.constants";

/**
 * What a handle needs to know about its node, and nothing else.
 *
 * Narrower than `NodeData` on purpose: `PanelNode` renders the same handles but
 * has none of the C4 node's data, and passing a synthetic `NodeData` to get at
 * `buildHandles` would tie panel rendering to a shape it does not have.
 */
export type HandleBehaviour = Pick<
  NodeData,
  "elementId" | "isRecording" | "lastRecordedHandleId" | "activeHandleId" | "onHandleClick"
>;

/**
 * Slots actually rendered on one side, clamped the same way
 * `buildEdgeHandleAssignments` clamps the slot it hands an edge. The two have to
 * agree: a `target-2` assigned to a node that rendered two handles is React Flow
 * error #008, and the edge is dropped with only a console warning.
 */
export function handleSlotCount(count: number): number {
  return Math.min(MAX_HANDLES, Math.max(MIN_HANDLES, count));
}

/**
 * Vertical placement of slot `index` of `count`, as a percentage of the node's
 * height. `renderedEdgePath.handleAnchor` measures against this exact formula —
 * `renderedEdgePath.test.ts` holds them together.
 */
export function handleTopPercent(index: number, count: number): number {
  return ((index + 1) / (count + 1)) * 100;
}

function getHandleClass(d: HandleBehaviour, handleId: string): string {
  const base = "!border-background transition-all duration-150";
  const isRecHighlighted = d.isRecording && d.lastRecordedHandleId === handleId;
  const isPlayHighlighted = !d.isRecording && d.activeHandleId === handleId;

  if (isRecHighlighted) {
    return `${base} !w-3.5 !h-3.5 !bg-primary ring-2 ring-primary`;
  }
  if (isPlayHighlighted) {
    return `${base} !w-3.5 !h-3.5 !bg-primary ring-2 ring-primary animate-pulse`;
  }
  if (d.isRecording) {
    return `${base} !w-3.5 !h-3.5 !bg-primary/60 cursor-pointer hover:!bg-primary hover:ring-2 hover:ring-primary`;
  }
  return `${base} !w-2.5 !h-2.5 !bg-muted-foreground`;
}

export function buildHandles(
  count: number,
  type: "source" | "target",
  position: Position,
  d: HandleBehaviour,
  handlePointer: React.CSSProperties | undefined,
  classNameFor: (d: HandleBehaviour, handleId: string) => string = getHandleClass,
): React.ReactNode[] {
  const n = handleSlotCount(count);
  if (n <= 1) {
    const handleId = `${type}-0`;
    const onClick =
      d.isRecording && d.onHandleClick
        ? (e: React.MouseEvent) => {
            e.stopPropagation();
            d.onHandleClick!(d.elementId, handleId);
          }
        : undefined;
    return [
      <Handle
        key={handleId}
        id={handleId}
        type={type}
        position={position}
        className={classNameFor(d, handleId)}
        style={handlePointer}
        onClick={onClick}
      />,
    ];
  }
  return Array.from({ length: n }, (_, i) => {
    const handleId = `${type}-${i}`;
    const onClick =
      d.isRecording && d.onHandleClick
        ? (e: React.MouseEvent) => {
            e.stopPropagation();
            d.onHandleClick!(d.elementId, handleId);
          }
        : undefined;
    return (
      <Handle
        key={handleId}
        id={handleId}
        type={type}
        position={position}
        className={classNameFor(d, handleId)}
        style={{
          ...handlePointer,
          top: `${handleTopPercent(i, n)}%`,
        }}
        onClick={onClick}
      />
    );
  });
}

/**
 * Class for a panel's handles: present in the DOM, invisible, inert.
 *
 * A panel is `connectable: false` — the user cannot start a connection from it —
 * so a visible dot would advertise an affordance the panel does not have. What
 * the element is for is React Flow's edge resolution: `target-N` has to exist on
 * the node the edge names, or React Flow refuses to create the edge (error #008)
 * and it vanishes from the canvas with nothing but a console warning.
 */
function panelHandleClass(): string {
  return "!w-2.5 !h-2.5 !bg-transparent !border-transparent !opacity-0";
}

/**
 * The handles a panel renders, so an edge addressed to a container has somewhere
 * to attach.
 *
 * Same slot count and same vertical formula as every other node, because
 * `buildEdgeHandleAssignments` does not special-case panels when it picks a slot
 * and `handleAnchor` does not special-case them when it measures. `pointerEvents:
 * none` keeps them out of the way of `.panel-header`, `.panel-border` and
 * `.panel-body`, the three named hit regions the panel's drag and marquee
 * behaviour depends on.
 */
export function buildPanelHandles(
  count: number,
  type: "source" | "target",
  position: Position,
  elementId: string,
): React.ReactNode[] {
  return buildHandles(
    count,
    type,
    position,
    { elementId },
    { pointerEvents: "none" },
    panelHandleClass,
  );
}
