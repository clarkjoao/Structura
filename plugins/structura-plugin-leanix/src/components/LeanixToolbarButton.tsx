import type { FC } from "react";
import type { PluginPanelProps } from "../types/plugin";
import { LABELS, t, type Locale } from "../i18n/labels";
import { showToast, openModal, getApi } from "../hooks/usePluginApi";
import { LeanixConfigModal } from "./LeanixConfigModal";
import { exportDiagram, getDiagramUrl, exportDrawio } from "../services";
import { useLeanixConfig } from "../hooks/useLeanixConfig";

/**
 * Leanix Toolbar Button Component
 */
export const LeanixToolbarButton: FC<PluginPanelProps> = ({ context }) => {
  const locale = (context?.locale || "en") as Locale;
  const isEditMode = context?.isEditMode !== false;
  const { config: currentConfig, isConfigured } = useLeanixConfig();

  const openConfigModal = () => {
    openModal({
      title: t(LABELS.config.title, locale),
      content: LeanixConfigModal,
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
      // Use the draw.io exporter to generate mxGraphModel XML
      if (!diagram) {
        showToast({
          type: "error",
          title: "No diagram available",
          duration: 5000,
        });
        return;
      }

      const graphXml = exportDrawio(diagram);

      const result = await exportDiagram(
        currentConfig,
        diagram.name,
        graphXml,
        currentConfig.userId
      );

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
    } catch (error) {
      console.error("[Leanix Plugin] Export failed:", error);
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      {/* Main Send button */}
      <button
        type="button"
        onClick={isDisabled ? undefined : handleSend}
        disabled={isDisabled}
        title={tooltip}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-card/90 backdrop-blur-sm px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
      >
        <span>📤</span>
        <span>{t(LABELS.toolbar.button, locale)}</span>
      </button>

      {/* Config button */}
      <button
        type="button"
        onClick={openConfigModal}
        title={t(LABELS.config.title, locale)}
        className="text-xs px-2 py-1 rounded bg-secondary/50 hover:bg-secondary transition-colors"
      >
        {isConfigured ? "✓" : "⚙"}
      </button>
    </div>
  );
};
