import type { PluginPanelProps } from "../types/plugin.types";
import { LABELS, t } from "../i18n/labels";
import { showToast } from "../hooks/usePluginApi";

/**
 * Panel shown in the element inspector when an element is selected. A plain React component
 * typed against the host's PluginPanelProps — no factory, no getReact, no React.createElement.
 */
export function SettingsPanel({ context }: PluginPanelProps) {
  const locale = (context.locale || "en") as "en" | "pt-BR";
  const selection = context.selection ?? [];

  const handleTestToast = () => {
    showToast({
      type: "info",
      title: t(LABELS.toasts.settingsPanel, locale),
      description: t(LABELS.toasts.settingsPanelDesc, locale),
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">{t(LABELS.settings.title, locale)}</p>
      <p className="text-xs text-muted-foreground">{t(LABELS.settings.description, locale)}</p>

      {selection.length > 0 && (
        <div className="rounded-md bg-muted p-2 text-xs text-foreground">
          <strong>{t(LABELS.settings.selected, locale)}</strong> {selection.length} element(s)
        </div>
      )}

      <button
        type="button"
        onClick={handleTestToast}
        className="w-full rounded-md bg-secondary px-3 py-2 text-xs font-medium transition-colors hover:bg-secondary/80"
      >
        {t(LABELS.settings.testToast, locale)}
      </button>
    </div>
  );
}
