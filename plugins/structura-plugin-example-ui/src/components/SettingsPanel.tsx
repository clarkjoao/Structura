import type { ReactElement } from "react";
import type { PanelContext } from "../types/plugin";
import { LABELS, t } from "../i18n/labels";
import { showToast, getReact } from "../hooks/usePluginApi";

/**
 * Settings Panel Component
 *
 * Demonstrates panel contribution in the element inspector.
 * Shows when an element is selected.
 */
export function SettingsPanel({ context }: { context: PanelContext }): ReactElement {
  const locale = context?.locale || "en";
  const selection = context?.selection || [];
  const React = getReact();

  const handleTestToast = () => {
    showToast({
      type: "info",
      title: t(LABELS.toasts.settingsPanel, locale),
      description: t(LABELS.toasts.settingsPanelDesc, locale),
    });
  };

  return React.createElement(
    "div",
    { className: "space-y-3" },
    // Title
    React.createElement(
      "p",
      { className: "text-sm font-medium" },
      t(LABELS.settings.title, locale)
    ),
    // Description
    React.createElement(
      "p",
      { className: "text-xs text-muted-foreground" },
      t(LABELS.settings.description, locale)
    ),
    // Selection info
    selection.length > 0 &&
      React.createElement(
        "div",
        { className: "rounded-md bg-muted p-2 text-xs" },
        React.createElement("strong", null, t(LABELS.settings.selected, locale)),
        " ",
        selection.length,
        " element(s)"
      ),
    // Test toast button
    React.createElement(
      "button",
      {
        type: "button",
        onClick: handleTestToast,
        className: "w-full rounded-md bg-secondary px-3 py-2 text-xs font-medium hover:bg-secondary/80 transition-colors",
      },
      t(LABELS.settings.testToast, locale)
    )
  );
}
