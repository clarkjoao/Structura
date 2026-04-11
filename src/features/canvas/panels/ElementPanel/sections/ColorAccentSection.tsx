import { useTranslation } from "react-i18next";
import type { Component } from "@/features/diagram";
import ColorSwatches, { type ColorPresetGroup } from "../components/ColorSwatches";

export type ColorAccentPreset = Extract<ColorPresetGroup, "note" | "c4">;

export interface ColorAccentSectionProps {
  componentId: string;
  
  type: ColorAccentPreset;
  currentColor: string;
  updateComponent: (id: string, patch: Partial<Omit<Component, "id">>) => void;
  allowClear?: boolean;
}

export function ColorAccentSection({
  componentId,
  type,
  currentColor,
  updateComponent,
  allowClear,
}: ColorAccentSectionProps) {
  const { t } = useTranslation();
  const label =
    type === "note" ? t("elementPanel.noteColorLabel") : t("elementPanel.borderColorLabel");

  return (
    <ColorSwatches
      componentId={componentId}
      currentColor={currentColor}
      label={label}
      presetGroup={type}
      allowClear={allowClear}
      updateComponent={updateComponent}
    />
  );
}
