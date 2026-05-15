import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/hooks/useTheme";
import type { ComponentPatch } from "@/features/diagram";
import ColorSwatches, { type ColorPresetGroup } from "../components/ColorSwatches";
import { getNotePresetPair } from "../components/colorPresets";

export type ColorAccentPreset = Extract<ColorPresetGroup, "note" | "note-dark" | "c4">;

export interface ColorAccentSectionProps {
  componentId: string;
  type: ColorAccentPreset;
  currentColor: string;
  updateComponent: (id: string, patch: ComponentPatch) => void;
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
  const { theme } = useTheme();

  const label =
    type === "note" || type === "note-dark"
      ? t("elementPanel.noteColorLabel")
      : t("elementPanel.borderColorLabel");

  const wrappedUpdate = useCallback(
    (id: string, patch: ComponentPatch) => {
      // Non-note types: pass through unchanged
      if (type !== "note" && type !== "note-dark") {
        updateComponent(id, patch);
        return;
      }

      // "Reset to default" (allowClear): clear both fields
      if ("panelColor" in patch && patch.panelColor === undefined) {
        updateComponent(id, { panelColor: undefined, panelColorDark: undefined });
        return;
      }

      const pickedColor = patch.panelColor;
      if (!pickedColor) {
        updateComponent(id, patch);
        return;
      }

      // Preset color: write BOTH light and dark fields simultaneously
      const pair = getNotePresetPair(pickedColor);
      if (pair) {
        updateComponent(id, {
          panelColor: pair.light,
          panelColorDark: pair.dark,
        });
        return;
      }

      // Custom color (not in any preset): write only the current-theme field
      if (theme === "dark") {
        updateComponent(id, { panelColorDark: pickedColor });
      } else {
        updateComponent(id, { panelColor: pickedColor });
      }
    },
    [type, theme, updateComponent],
  );

  return (
    <ColorSwatches
      componentId={componentId}
      currentColor={currentColor}
      label={label}
      presetGroup={type}
      allowClear={allowClear}
      updateComponent={wrappedUpdate}
    />
  );
}
