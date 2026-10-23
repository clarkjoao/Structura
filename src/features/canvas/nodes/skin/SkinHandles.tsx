import type { CSSProperties } from "react";
import { Handle } from "@xyflow/react";
import { useHandleSides } from "../../contexts/ReadingDirectionContext";

const HANDLE_CLASS = "!w-2.5 !h-2.5 !border-2 !border-background !bg-muted-foreground";
/** Present for edge resolution only: no dot, no pointer, no new connection. */
const INERT_HANDLE_CLASS = "!w-2.5 !h-2.5 !bg-transparent !border-transparent !opacity-0";

export interface HandlePoint {
  x: number;
  y: number;
}

/**
 * The one input and the one output a skinned element declares
 * (`SINGLE_PAIR_HANDLES`), on the sides of the reading direction, placed on the
 * outline points the caller gives for them.
 *
 * An element that is not connectable (a named line) still renders them, invisible and inert, so an edge that reaches
 * it by any other path keeps a handle and is not dropped (#008).
 */
export function SkinHandles({
  input,
  output,
  w,
  h,
  inert = false,
}: {
  /** Where the input sits on the drawn outline. */
  input: HandlePoint;
  /** Where the output sits on the drawn outline. */
  output: HandlePoint;
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
  const sides = useHandleSides();
  return (
    <>
      <Handle
        id="target-0"
        type="target"
        position={sides.input}
        style={at(input)}
        className={className}
        isConnectable={!inert}
      />
      <Handle
        id="source-0"
        type="source"
        position={sides.output}
        style={at(output)}
        className={className}
        isConnectable={!inert}
      />
    </>
  );
}
