import { Palette } from "lucide-react";
import type { Component } from "@/features/diagram";
import { PANEL_COLOR_PRESETS } from "./colorPresets";

interface ColorSwatchesProps {
  componentId: string;
  currentColor: string;
  label: string;
  updateComponent: (id: string, patch: Partial<Omit<Component, "id">>) => void;
}

const ColorSwatches = ({ componentId, currentColor, label, updateComponent }: ColorSwatchesProps) => (
  <div>
    <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-2 block">
      <Palette className="h-3 w-3 inline mr-1" />
      {label}
    </label>
    <div className="grid grid-cols-4 gap-2">
      {PANEL_COLOR_PRESETS.map((preset) => (
        <button
          key={preset.name}
          onClick={() => updateComponent(componentId, { panelColor: preset.color })}
          className={`group relative h-8 rounded-md border-2 transition-all ${
            currentColor === preset.color
              ? "border-foreground scale-105 shadow-md"
              : "border-transparent hover:border-muted-foreground/40 hover:scale-105"
          }`}
          style={{ backgroundColor: preset.color }}
          title={preset.name}
        >
          {currentColor === preset.color && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-white shadow-sm" />
            </div>
          )}
        </button>
      ))}
    </div>
  </div>
);

export default ColorSwatches;
