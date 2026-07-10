import { RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { VIBRANT_PRESETS } from "@/features/canvas/panels/ElementPanel/components/colorPresets";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
  selectedColor?: string;
  onSelectColor: (color: string) => void;
  onReset?: () => void;
  compact?: boolean;
}

export function ColorPicker({
  selectedColor,
  onSelectColor,
  onReset,
  compact = false,
}: ColorPickerProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-0.5">
        {VIBRANT_PRESETS.slice(0, compact ? 8 : 15).map((preset) => {
          const isSelected = selectedColor === preset.color;
          return (
            <button
              key={preset.color}
              type="button"
              title={t(preset.nameKey)}
              aria-label={t(preset.nameKey)}
              onClick={() => onSelectColor(preset.color)}
              className={cn(
                "rounded-full border-2 transition-all hover:scale-110",
                compact ? "h-4 w-4" : "h-5 w-5",
                isSelected
                  ? "scale-110 border-foreground"
                  : "border-transparent",
              )}
              style={{ backgroundColor: preset.color }}
            />
          );
        })}
      </div>
      {onReset && (
        <button
          type="button"
          title={t("colorSwatches.default")}
          aria-label={t("colorSwatches.default")}
          onClick={onReset}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
