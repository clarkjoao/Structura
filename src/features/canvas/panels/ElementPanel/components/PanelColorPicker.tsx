import { useTranslation } from "react-i18next";
import type { ComponentPatch } from "@/features/diagram";
import ColorSwatches from "./ColorSwatches";

interface PanelColorPickerProps {
  componentId: string;
  currentColor: string;
  currentOpacity: number;
  updateComponent: (id: string, patch: ComponentPatch) => void;
}

const PanelColorPicker = ({ componentId, currentColor, currentOpacity, updateComponent }: PanelColorPickerProps) => {
  const { t } = useTranslation();
  return (
  <div className="space-y-3">
    <ColorSwatches
      componentId={componentId}
      currentColor={currentColor}
      label={t("elementPanel.panelColorLabel")}
      presetGroup="panel"
      updateComponent={updateComponent}
    />
    <div>
      <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
        {t("elementPanel.opacityLabel", { value: currentOpacity })}
      </label>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={currentOpacity}
        onChange={(e) => updateComponent(componentId, { panelOpacity: Number(e.target.value) })}
        className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
      />
      <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
        <span>0%</span>
        <span>100%</span>
      </div>
    </div>
  </div>
  );
};

export default PanelColorPicker;
