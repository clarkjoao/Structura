import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Palette, Check, Plus, Minus } from "lucide-react";
import type { ComponentPatch } from "@/features/diagram";
import {
  VIBRANT_PRESETS,
  PAPER_PRESETS,
  C4_PRESETS,
  NEUTRAL_PRESETS,
  PANEL_PRESETS,
  NOTE_PRESETS,
  type ColorPreset,
} from "./colorPresets";

export type ColorPresetGroup =
  | "vibrant"
  | "paper"
  | "c4"
  | "neutral"
  | "panel"
  | "note"
  | "all";

interface ColorSwatchesProps {
  componentId: string;
  currentColor: string;
  label: string;
  updateComponent: (id: string, patch: ComponentPatch) => void;
  /** Preset group: `panel` = vibrant + neutral; `note` = paper + vibrant subset. */
  presetGroup?: ColorPresetGroup;
  /** When true, show a "Default" control to clear a custom color. */
  allowClear?: boolean;
}

function hslToHex(hsl: string): string {
  const match = hsl.match(/hsl\(\s*([\d.]+)\s+([\d.]+)%?\s+([\d.]+)%?\s*\)/);
  if (!match) return hsl;
  const h = parseFloat(match[1]) / 360;
  const s = parseFloat(match[2]) / 100;
  const l = parseFloat(match[3]) / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  const r = Math.round(f(0) * 255);
  const g = Math.round(f(8) * 255);
  const b = Math.round(f(4) * 255);
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

function hexToHsl(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;
  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return `hsl(${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
}

function normalizeColor(color: string): string {
  if (color.startsWith("#")) return color;
  if (color.startsWith("hsl(")) return hslToHex(color);
  return color;
}

function presetsForGroup(group: ColorPresetGroup): ColorPreset[] {
  switch (group) {
    case "vibrant":
      return VIBRANT_PRESETS;
    case "paper":
      return PAPER_PRESETS;
    case "c4":
      return C4_PRESETS;
    case "neutral":
      return NEUTRAL_PRESETS;
    case "panel":
      return PANEL_PRESETS;
    case "note":
      return NOTE_PRESETS;
    case "all":
      return [
        ...VIBRANT_PRESETS,
        ...PAPER_PRESETS,
        ...C4_PRESETS,
        ...NEUTRAL_PRESETS,
      ];
    default:
      return VIBRANT_PRESETS;
  }
}

const COLS = 5;
const ROWS_COLLAPSED = 2;
const VISIBLE_COUNT = COLS * ROWS_COLLAPSED; // 10 cores nas 2 primeiras fileiras

const ColorSwatches = ({
  componentId,
  currentColor,
  label,
  updateComponent,
  presetGroup = "vibrant",
  allowClear = false,
}: ColorSwatchesProps) => {
  const { t } = useTranslation();
  const [customHex, setCustomHex] = useState(() =>
    normalizeColor(currentColor).replace("#", ""),
  );
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setCustomHex(normalizeColor(currentColor).replace("#", ""));
  }, [currentColor]);

  const presets = presetsForGroup(presetGroup);
  const visiblePresets = expanded ? presets : presets.slice(0, VISIBLE_COUNT);
  const hasMore = presets.length > VISIBLE_COUNT;
  const currentHex = normalizeColor(currentColor).toLowerCase();

  const handlePresetClick = (color: string) => {
    updateComponent(componentId, { panelColor: color });
  };

  const handleCustomChange = (hex: string) => {
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
      updateComponent(componentId, { panelColor: hexToHsl(hex) });
      setCustomHex(hex.replace("#", ""));
    }
  };

  const handleCustomSubmit = () => {
    const hex = customHex.startsWith("#") ? customHex : `#${customHex}`;
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
      updateComponent(componentId, { panelColor: hexToHsl(hex) });
    }
  };

  const handleCustomKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleCustomSubmit();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold flex items-center gap-1">
          <Palette className="h-3 w-3" />
          {label}
        </label>
        <div className="flex items-center gap-2">
          {allowClear && (
            <button
              type="button"
              onClick={() => updateComponent(componentId, { panelColor: undefined })}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("colorSwatches.default")}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        {visiblePresets.map((preset) => {
          const isSelected =
            currentHex === normalizeColor(preset.color).toLowerCase();
          return (
            <button
              key={`${preset.nameKey}-${preset.color}`}
              onClick={() => handlePresetClick(preset.color)}
              className={`group relative h-7 rounded-md border-2 transition-all ${
                isSelected
                  ? "border-foreground scale-105 shadow-md"
                  : "border-transparent hover:border-muted-foreground/50 hover:scale-105"
              }`}
              style={{ backgroundColor: preset.color }}
              title={t(preset.nameKey)}
            >
              {isSelected && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Check className="h-3 w-3 text-white drop-shadow-md" strokeWidth={3} />
                </div>
              )}
            </button>
          );
        })}
        {!expanded && hasMore && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="h-7 rounded-md border-2 border-dashed border-muted-foreground/40 hover:border-muted-foreground hover:bg-muted/50 transition-all flex items-center justify-center"
            title={t("colorSwatches.moreColors")}
          >
            <Plus className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-border space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
              {t("colorSwatches.customColor")}
            </p>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              title={t("colorSwatches.showLess")}
            >
              <Minus className="h-3 w-3" />
              {t("colorSwatches.showLess")}
            </button>
          </div>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={
                /^[0-9a-fA-F]{6}$/.test(customHex)
                  ? `#${customHex}`
                  : "#808080"
              }
              onChange={(e) => handleCustomChange(e.target.value)}
              className="h-8 w-10 rounded-md border border-border cursor-pointer bg-transparent p-0"
            />
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                #
              </span>
              <input
                type="text"
                value={customHex}
                onChange={(e) =>
                  setCustomHex(e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6))
                }
                onKeyDown={handleCustomKeyDown}
                onBlur={handleCustomSubmit}
                placeholder={t("colorSwatches.hexPlaceholder")}
                className="w-full pl-6 pr-2 py-1.5 rounded-md border border-border bg-secondary text-sm text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div
              className="w-8 h-8 rounded-md border border-border shrink-0"
              style={{
                backgroundColor: /^[0-9a-fA-F]{6}$/.test(customHex)
                  ? `#${customHex}`
                  : "transparent",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ColorSwatches;
