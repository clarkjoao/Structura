import { Badge, Button, Stack } from "@structura/ui";
import type { PluginPanelProps } from "../types/plugin.types";
import { LABELS, t } from "../i18n/labels";
import { showToast } from "../hooks/usePluginApi";

/**
 * Panel shown in the element inspector when an element is selected. A plain React component
 * typed against the host's PluginPanelProps, drawn with the host's own components
 * (`@structura/ui`, API 1.18) so it matches the inspector around it in light and dark.
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
    <Stack gap={3}>
      <p className="text-sm font-medium text-foreground">{t(LABELS.settings.title, locale)}</p>
      <p className="text-xs text-muted-foreground">{t(LABELS.settings.description, locale)}</p>

      {selection.length > 0 && (
        <Stack direction="row" gap={2} align="center">
          <span className="text-xs text-foreground">{t(LABELS.settings.selected, locale)}</span>
          <Badge variant="secondary">{selection.length}</Badge>
        </Stack>
      )}

      <Button variant="secondary" size="sm" onClick={handleTestToast}>
        {t(LABELS.settings.testToast, locale)}
      </Button>
    </Stack>
  );
}
