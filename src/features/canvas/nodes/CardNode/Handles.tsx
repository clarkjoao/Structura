import { Handle, Position } from "@xyflow/react";
import type { NodeData } from "./types";
import { HANDLE_PITCH, MIN_HANDLES, MAX_HANDLES } from "../../canvas.constants";

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
 * Vertical placement of slot `index` of `count`, as CSS against the node's
 * height: `handleSlotOffset` written so the browser resolves it, since the
 * height is only known once laid out. `renderedEdgePath.handleAnchor` measures
 * with `handleSlotOffset` itself — `renderedEdgePath.test.ts` holds them
 * together.
 */
export function handleTopCss(index: number, count: number): string {
  if (count <= 1) return "50%";
  const fromMiddle = index - (count - 1) / 2;
  return `calc(50% + ${fromMiddle} * min(${HANDLE_PITCH}px, ${100 / (count + 1)}%))`;
}

/** A lit handle's size: full on its own, or a bundle's pitch so neighbours never overlap. */
const LIT_SIZE = "!w-3.5 !h-3.5";
const LIT_SIZE_BUNDLED = "!w-[7px] !h-[7px]";

function getHandleClass(d: HandleBehaviour, handleId: string, litSize = LIT_SIZE): string {
  const base = "!border-background transition-all duration-150";
  const isRecHighlighted = d.isRecording && d.lastRecordedHandleId === handleId;
  const isPlayHighlighted = !d.isRecording && d.activeHandleId === handleId;

  if (isRecHighlighted) {
    return `${base} ${litSize} !bg-primary ring-2 ring-primary`;
  }
  if (isPlayHighlighted) {
    return `${base} ${litSize} !bg-primary ring-2 ring-primary animate-pulse`;
  }
  if (d.isRecording) {
    return `${base} ${litSize} !bg-primary/60 cursor-pointer hover:!bg-primary hover:ring-2 hover:ring-primary`;
  }
  return `${base} !w-2.5 !h-2.5 !bg-muted-foreground`;
}

/**
 * Class for one slot of a bundle: there to connect to, but not drawn.
 *
 * Slots sit `HANDLE_PITCH` apart, closer than a dot is wide, so drawing each
 * one smeared them into a bar; `bundleDot` draws the side's one dot instead.
 * Recording picks among the slots, so it draws every one, and playback lights
 * one up — both a pixel under `HANDLE_PITCH` wide, so neighbouring slots stay
 * apart enough to click.
 */
function bundledHandleClass(d: HandleBehaviour, handleId: string): string {
  if (d.isRecording || d.activeHandleId === handleId) {
    return getHandleClass(d, handleId, LIT_SIZE_BUNDLED);
  }
  return "!w-2.5 !h-2.5 !bg-transparent !border-transparent";
}

/** The one dot a bundled side shows, in the middle; it takes no pointer. */
function bundleDot(type: "source" | "target", position: Position): React.ReactNode {
  return (
    <div
      key={`${type}-dot`}
      aria-hidden
      className="pointer-events-none absolute top-1/2 h-2.5 w-2.5 rounded-full border border-background bg-muted-foreground"
      style={{
        [position === Position.Left ? "left" : "right"]: 0,
        transform: `translate(${position === Position.Left ? "-50%" : "50%"}, -50%)`,
      }}
    />
  );
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
  // A bundle is drawn as one dot unless the caller styles its own slots (a
  // panel's are invisible) or a flow is being recorded, which picks a slot.
  const bundled = classNameFor === getHandleClass;
  const slotClassFor = bundled ? bundledHandleClass : classNameFor;
  const showDot = bundled && !d.isRecording;
  const slots = Array.from({ length: n }, (_, i) => {
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
        className={slotClassFor(d, handleId)}
        style={{
          ...handlePointer,
          top: handleTopCss(i, n),
        }}
        onClick={onClick}
      />
    );
  });
  return showDot ? [...slots, bundleDot(type, position)] : slots;
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
