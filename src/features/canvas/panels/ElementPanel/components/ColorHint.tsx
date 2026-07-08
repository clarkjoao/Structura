import { useTranslation } from "react-i18next";
import { useTheme } from "@/hooks/useTheme";
import {
  isFlowNodeComponent,
  isNoteComponent,
  isProcessNodeComponent,
  type Component,
} from "@/features/diagram";
import { PANEL_PRESETS } from "./colorPresets";

interface ColorHintProps {
  component: Component;
  onOpenQuickActions: () => void;
}

function readColor(component: Component, isDark: boolean): string | undefined {
  if (isFlowNodeComponent(component) || isProcessNodeComponent(component)) {
    return "nodeColor" in component ? component.nodeColor : undefined;
  }
  if (isNoteComponent(component)) {
    return isDark
      ? "panelColorDark" in component
        ? (component as { panelColorDark?: string }).panelColorDark
        : undefined
      : "panelColor" in component
        ? (component as { panelColor?: string }).panelColor
        : undefined;
  }
  if ("panelColor" in component) {
    return (component as { panelColor?: string }).panelColor;
  }
  return undefined;
}

function findPresetNameKey(color: string | undefined): string | null {
  if (!color) return null;
  const match = PANEL_PRESETS.find((p) => p.color === color);
  return match ? match.nameKey : null;
}

export function ColorHint({ component, onOpenQuickActions }: ColorHintProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const color = readColor(component, isDark);
  const nameKey = findPresetNameKey(color);
  const label = nameKey
    ? t("elementPanel.colorHintLabel", { name: t(nameKey) })
    : t("elementPanel.colorHintDefault");

  return (
    <div className="flex items-center justify-between gap-2 border-b border-border bg-secondary/20 px-3 py-2 text-xs">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span
          aria-hidden
          className="inline-block h-2 w-2 rounded-sm border border-border"
          style={{ backgroundColor: color ?? "transparent" }}
        />
        <span>{label}</span>
      </div>
      <button
        type="button"
        onClick={onOpenQuickActions}
        className="rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-accent"
      >
        {t("elementPanel.openQuickActions")}
      </button>
    </div>
  );
}
