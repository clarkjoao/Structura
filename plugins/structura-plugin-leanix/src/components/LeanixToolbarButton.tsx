import type { ReactElement } from "react";
import type { PanelContext } from "../types/plugin";
import { showToast, openModal, getReact, getApi } from "../hooks/usePluginApi";
import { LABELS, t, type Locale } from "../i18n/labels";
import { LeanixConfigModal } from "./LeanixConfigModal";
import { exportDiagram, getDiagramUrl } from "../services";

/**
 * Leanix Toolbar Button Component
 */
export function LeanixToolbarButton({ context }: { context: PanelContext }): ReactElement {
  const locale = (context?.locale || "en") as Locale;
  const isEditMode = context?.isEditMode !== false;
  const React = getReact();

  // Get config from localStorage
  const getConfig = () => {
    try {
      const stored = localStorage.getItem("leanix_config");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  };

  const config = getConfig();
  const isConfigured = config !== null;

  const openConfigModal = () => {
    openModal({
      title: t(LABELS.config.title, locale),
      content: ({ onClose }) => React.createElement(LeanixConfigModal, { onClose }),
      size: "md",
    });
  };

  const handleSend = async () => {
    const api = getApi();
    const diagram = api.getDiagram();

    if (!diagram?.name) {
      showToast({
        type: "warning",
        title: t(LABELS.toasts.noName, locale),
        duration: 5000,
      });
      return;
    }

    const currentConfig = getConfig();
    if (!currentConfig) {
      showToast({
        type: "warning",
        title: t(LABELS.toasts.notConfigured, locale),
        duration: 5000,
      });
      return;
    }

    showToast({
      type: "info",
      title: t(LABELS.toasts.sending, locale),
      duration: 0, // Persistent
    });

    try {
      const result = await exportDiagram(currentConfig, diagram.name, "", currentConfig.userId);
      const successTitle = result.action === "created"
        ? t(LABELS.toasts.successCreated, locale)
        : t(LABELS.toasts.successUpdated, locale);

      showToast({
        type: "success",
        title: successTitle,
        action: {
          label: t(LABELS.toasts.openInLeanix, locale),
          onClick: () => window.open(getDiagramUrl(currentConfig, result.bookmark.id), "_blank"),
        },
        duration: 8000,
      });
    } catch {
      showToast({
        type: "error",
        title: t(LABELS.toasts.errorConnection, locale),
        action: {
          label: t(LABELS.toasts.openSettings, locale),
          onClick: openConfigModal,
        },
        duration: 8000,
      });
    }
  };

  // Disabled states
  let isDisabled = false;
  let tooltip = "";

  if (!isEditMode) {
    isDisabled = true;
    tooltip = t(LABELS.toolbar.tooltipReadOnly, locale);
  } else if (!isConfigured) {
    isDisabled = true;
    tooltip = t(LABELS.toolbar.tooltipNoConfig, locale);
  } else {
    const api = getApi();
    const diagram = api.getDiagram();
    if (!diagram?.name) {
      isDisabled = true;
      tooltip = t(LABELS.toolbar.tooltipNoName, locale);
    }
  }

  return React.createElement(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: "4px" } },
    // Main button
    React.createElement(
      "button",
      {
        type: "button",
        onClick: isDisabled ? undefined : handleSend,
        disabled: isDisabled,
        title: tooltip,
        className: "flex items-center gap-1.5 rounded-lg border border-border bg-card/90 backdrop-blur-sm px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors",
      },
      React.createElement("span", null, "📤"),
      React.createElement("span", null, t(LABELS.toolbar.button, locale))
    ),
    // Config button
    React.createElement(
      "button",
      {
        type: "button",
        onClick: openConfigModal,
        title: t(LABELS.config.title, locale),
        className: "text-xs px-2 py-1 rounded bg-secondary/50 hover:bg-secondary transition-colors",
      },
      isConfigured ? "✓" : "⚙"
    )
  );
}
