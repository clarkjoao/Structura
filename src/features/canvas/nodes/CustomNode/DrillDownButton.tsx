import { memo, useCallback } from "react";
import { MousePointerClick } from "lucide-react";
import { useTranslation } from "react-i18next";

interface DrillDownButtonProps {
  elementId: string;
  onDrillDown?: (id: string) => void;
  colorClass: string;
  customColor?: string;
  disabled?: boolean;
}

export const DrillDownButton = memo(function DrillDownButton({
  elementId,
  onDrillDown,
  colorClass,
  customColor,
  disabled,
}: DrillDownButtonProps) {
  const { t } = useTranslation();
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
      aria-label={t("customNode.drillAria", { id: elementId })}
      className={`mt-2 flex items-center gap-1 text-[10px] font-medium ${colorClass} ${
        disabled ? "pointer-events-none text-gray-500 opacity-50" : "hover:underline"
      }`}
      style={customColor ? { color: customColor } : undefined}
      tabIndex={disabled ? -1 : 0}
    >
      <MousePointerClick className="h-3 w-3" /> {t("customNode.drillExplore")}
    </button>
  );
});
