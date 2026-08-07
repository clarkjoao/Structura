import { Handle, Position } from "@xyflow/react";
import type { NodeData } from "./types";
import { MIN_HANDLES, MAX_HANDLES } from "../../canvas.constants";

function getHandleClass(d: NodeData, handleId: string): string {
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
  d: NodeData,
  handlePointer: React.CSSProperties | undefined,
): React.ReactNode[] {
  const n = Math.min(MAX_HANDLES, Math.max(MIN_HANDLES, count));
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
        className={getHandleClass(d, handleId)}
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
        className={getHandleClass(d, handleId)}
        style={{
          ...handlePointer,
          top: `${((i + 1) / (n + 1)) * 100}%`,
        }}
        onClick={onClick}
      />
    );
  });
}
