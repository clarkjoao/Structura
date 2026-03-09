import { memo } from "react";
import { NodeResizer, type NodeProps } from "@xyflow/react";
import { GripHorizontal } from "lucide-react";

const DEFAULT_NOTE_COLOR = "hsl(48 96% 53%)";

export interface NoteNodeData {
  elementId: string;
  name: string;
  description: string;
  panelColor?: string;
  isSelected: boolean;
}

function isDarkBg(color: string): boolean {
  if (color.startsWith("#")) {
    const hex = color.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return r * 0.299 + g * 0.587 + b * 0.114 < 140;
  }
  const match = color.match(/hsl\(\s*([\d.]+)\s+([\d.]+)%?\s+([\d.]+)%?\s*\)/);
  if (match) {
    return parseFloat(match[3]) < 45;
  }
  return false;
}

const NoteNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as NoteNodeData;
  const color = d.panelColor || DEFAULT_NOTE_COLOR;
  const isSelected = selected || d.isSelected;
  const dark = isDarkBg(color);
  const textClass = dark ? "text-white" : "text-gray-900";
  const mutedClass = dark ? "text-white/70" : "text-gray-900/60";

  return (
    <>
      <NodeResizer
        minWidth={160}
        minHeight={60}
        isVisible={isSelected}
        lineClassName="!border-transparent"
        handleClassName="!w-2 !h-2 !bg-gray-900/60 !border-white !rounded-full"
      />
      <div
        className={`min-w-[160px] max-w-[280px] rounded-lg shadow-md transition-shadow duration-200 ${
          isSelected ? "ring-2 ring-primary shadow-[0_0_0_2px_rgba(59,130,246,0.4)] brightness-110" : "opacity-90"
        }`}
        style={{ backgroundColor: color }}
      >
        <div className={`flex justify-center py-1 ${mutedClass} cursor-grab`}>
          <GripHorizontal className="h-3.5 w-3.5" />
        </div>
        <div className="px-3 pb-3 space-y-1">
          {d.name && (
            <p className={`text-xs font-semibold leading-tight ${textClass}`}>
              {d.name}
            </p>
          )}
          {d.description && (
            <p className={`text-sm leading-snug whitespace-pre-wrap ${dark ? "text-white/90" : "text-gray-900/80"}`}>
              {d.description}
            </p>
          )}
          {!d.name && !d.description && (
            <p className={`text-sm italic ${mutedClass}`}>Clique para editar...</p>
          )}
        </div>
      </div>
    </>
  );
});

NoteNode.displayName = "NoteNode";

export default NoteNode;
