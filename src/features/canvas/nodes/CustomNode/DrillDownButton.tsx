import { useCallback } from "react";
import { MousePointerClick } from "lucide-react";

interface DrillDownButtonProps {
  elementId: string;
  onDrillDown?: (id: string) => void;
  colorClass: string;
  customColor?: string;
  disabled?: boolean;
}

export const DrillDownButton = ({
  elementId,
  onDrillDown,
  colorClass,
  customColor,
  disabled,
}: DrillDownButtonProps) => {
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDrillDown?.(elementId);
    },
    [elementId, onDrillDown],
  );
  if (!onDrillDown) return null;
  return (
    <button
      onClick={handleClick}
      aria-label={`Explorar interior do elemento ${elementId}`}
      className={`mt-2 flex items-center gap-1 text-[10px] font-medium ${colorClass} ${
        disabled ? "pointer-events-none" : "hover:underline"
      }`}
      style={customColor ? { color: customColor } : undefined}
      tabIndex={disabled ? -1 : 0}
    >
      <MousePointerClick className="h-3 w-3" /> Explorar interior
    </button>
  );
};
