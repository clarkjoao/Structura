import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Palette, RotateCcw } from "lucide-react";
import {
  VIBRANT_PRESETS,
  PANEL_PRESETS,
  C4_PRESETS,
  NOTE_PRESETS,
  NOTE_PRESETS_DARK,
  getNotePresetPair,
  type ColorPreset,
} from "@/features/canvas/panels/ElementPanel/components/colorPresets";
import { cn } from "@/lib/utils";

export type ColorPickerGroup = "vibrant" | "panel" | "c4" | "note" | "note-dark";

interface ColorPickerProps {
  selectedColor?: string;
  onSelectColor: (color: string) => void;
  onReset?: () => void;
  /** Which preset group to show in the dropdown. Default: "vibrant". */
  group?: ColorPickerGroup;
}

const presetsForGroup = (group: ColorPickerGroup): ColorPreset[] => {
  switch (group) {
    case "panel":
      return PANEL_PRESETS;
    case "c4":
      return C4_PRESETS;
    case "note":
      return NOTE_PRESETS;
    case "note-dark":
      return NOTE_PRESETS_DARK;
    default:
      return VIBRANT_PRESETS;
  }
};

export function ColorPicker({
  selectedColor,
  onSelectColor,
  onReset,
  group = "vibrant",
}: ColorPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const presets = presetsForGroup(group);
  // For note presets, look up the pair so the swatch shows light-side color
  // regardless of theme.
  const selectedPreset =
    presets.find((p) => p.color === selectedColor) ??
    (group === "note" || group === "note-dark"
      ? presets.find((p) => {
          const pair = getNotePresetPair(selectedColor ?? "");
          return pair && (group === "note" ? pair.light === p.color : pair.dark === p.color);
        })
      : undefined);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const swatchSize = "h-3.5 w-3.5";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex items-center gap-1 h-6 px-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
        title={t("canvas.quickActions.color")}
        aria-label={t("canvas.quickActions.color")}
      >
        {selectedPreset ? (
          <span
            className="h-3.5 w-3.5 rounded-full border border-border"
            style={{ backgroundColor: selectedPreset.color }}
          />
        ) : (
          <Palette className="h-3.5 w-3.5" />
        )}
      </button>

      {open && (
        <div
          className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 bg-card border border-border rounded-md shadow-lg p-2 min-w-[148px]"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex flex-wrap gap-1.5 justify-center max-w-[160px]">
            {presets.map((preset) => {
              const isSelected = selectedColor === preset.color;
              return (
                <button
                  key={preset.color}
                  type="button"
                  title={t(preset.nameKey)}
                  aria-label={t(preset.nameKey)}
                  onClick={() => {
                    onSelectColor(preset.color);
                    setOpen(false);
                  }}
                  className={cn(
                    "rounded-full border transition-all hover:scale-110 shrink-0",
                    swatchSize,
                    isSelected ? "scale-110 border-foreground" : "border-transparent",
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
              onClick={() => {
                onReset();
                setOpen(false);
              }}
              className="mt-2 w-full flex items-center justify-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-surface-hover rounded transition-colors border-t border-border pt-1.5"
            >
              <RotateCcw className="h-3 w-3" />
              {t("colorSwatches.default")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
