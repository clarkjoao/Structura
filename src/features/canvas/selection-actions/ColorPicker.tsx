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

  // Wrap onto two rows when toolbar space is tight
  const swatchSize = compact ? "h-3 w-3" : "h-3.5 w-3.5";
  const swatchGap = "gap-[3px]";
  const container = compact ? "flex flex-col" : "flex items-center";

  return (
    <div className={cn(container, "gap-[3px]")}>
      <div className={cn("flex", swatchGap)}>
        {VIBRANT_PRESETS.slice(0, 10).map((preset) => {
          const isSelected = selectedColor === preset.color;
          return (
            <button
              key={preset.color}
              type="button"
              title={t(preset.nameKey)}
              aria-label={t(preset.nameKey)}
              onClick={() => onSelectColor(preset.color)}
              className={cn(
                "rounded-full border transition-all hover:scale-110",
                swatchSize,
                isSelected
                  ? "scale-110 border-foreground"
                  : "border-transparent",
              )}
              style={{ backgroundColor: preset.color }}
            />
          );
        })}
      </div>
      {compact && (
        <div className={cn("flex", swatchGap)}>
          {VIBRANT_PRESETS.slice(10).map((preset) => {
            const isSelected = selectedColor === preset.color;
            return (
              <button
                key={preset.color}
                type="button"
                title={t(preset.nameKey)}
                aria-label={t(preset.nameKey)}
                onClick={() => onSelectColor(preset.color)}
                className={cn(
                  "rounded-full border transition-all hover:scale-110",
                  swatchSize,
                  isSelected
                    ? "scale-110 border-foreground"
                    : "border-transparent",
                )}
                style={{ backgroundColor: preset.color }}
              />
            );
          })}
        </div>
      )}
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