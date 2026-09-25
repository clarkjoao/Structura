import type { CSSProperties } from "react";
import { Handle, Position } from "@xyflow/react";

const HANDLE_CLASS = "!w-2.5 !h-2.5 !border-2 !border-background !bg-muted-foreground";
/** Present for edge resolution only: no dot, no pointer, no new connection. */
const INERT_HANDLE_CLASS = "!w-2.5 !h-2.5 !bg-transparent !border-transparent !opacity-0";

export interface HandlePoint {
  x: number;
  y: number;
}

/**
 * The one input on the left and the one output on the right that a VSM
 * element declares (`SINGLE_PAIR_HANDLES`), placed on its drawn outline.
 *
 * An element that is not connectable (a push arrow, a kaizen burst, the
 * timeline) still renders them, invisible and inert, so an edge that reaches
 * it by any other path keeps a handle and is not dropped (#008).
 */
export function SkinHandles({
  left,
  right,
  w,
  h,
  inert = false,
}: {
  left: HandlePoint;
  right: HandlePoint;
  w: number;
  h: number;
  inert?: boolean;
}) {
  const at = (p: HandlePoint): CSSProperties => ({
    left: `${(p.x / w) * 100}%`,
    top: `${(p.y / h) * 100}%`,
    right: "auto",
    bottom: "auto",
    transform: "translate(-50%, -50%)",
    ...(inert ? { pointerEvents: "none" as const } : {}),
  });
  const className = inert ? INERT_HANDLE_CLASS : HANDLE_CLASS;
  return (
    <>
      <Handle
        id="target-0"
        type="target"
        position={Position.Left}
        style={at(left)}
        className={className}
        isConnectable={!inert}
      />
      <Handle
        id="source-0"
        type="source"
        position={Position.Right}
        style={at(right)}
        className={className}
        isConnectable={!inert}
      />
    </>
  );
}
