import type { ReactElement } from "react";
import { LABELS, t, type Locale } from "../i18n";
import { showToast, openModal, getReact, getApi } from "../hooks/usePluginApi";
import { useLeanixConfig } from "../hooks/useLeanixConfig";
import { LeanixService, LeanixAuthError, LeanixServerError, LeanixNetworkError } from "../services";
import { LeanixConfigModal } from "./LeanixConfigModal";

/**
 * Leanix Toolbar Button Component
 *
 * Renders in the canvas toolbar. Handles the export flow:
 * 1. Check configuration
 * 2. Get diagram name
 * 3. Search for existing diagram
 * 4. Create or update
 * 5. Show toast with result
 */
export function LeanixToolbarButton({ context }: { context: { locale: string; isEditMode: boolean } }): ReactElement {
  const React = getReact();
  const locale = (context?.locale || "en") as Locale;
  const isEditMode = context?.isEditMode !== false;
  const { config, isConfigured, isLoading } = useLeanixConfig();

  const getDiagramUrl = (bookmarkId: string): string => {
    if (!config) return "#";
    const baseUrl = config.baseUrl.replace(/\/$/, "");
    return `${baseUrl}/pathfinder#/presentations/${bookmarkId}`;
  };

  const handleClick = async () => {
    // Get diagram
    const api = getApi();
    const diagram = api.getDiagram();

    if (!diagram?.name) {
      showToast({
        type: "warning",
        title: t(LABELS.toasts.errorConnection, locale),
        description: t(LABELS.toasts.errorConnectionDesc, locale),
        duration: 5000,
      });
      return;
    }

    // Show loading toast
    showToast({
      type: "info",
      title: t(LABELS.toasts.sending, locale),
      description: t(LABELS.toasts.sendingDesc, locale),
      duration: 0, // Persistent until replaced
    });

    try {
      const service = new LeanixService(config!);
      const result = await service.exportDiagram(diagram.name, "", config!.userId);

      // Determine success message
      const successTitle =
        result.action === "created"
          ? t(LABELS.toasts.successCreated, locale)
          : t(LABELS.toasts.successUpdated, locale);

      // Open link in new tab
      const openLink = () => {
        window.open(getDiagramUrl(result.bookmark.id), "_blank", "noopener,noreferrer");
      };

      showToast({
        type: "success",
        title: successTitle,
        action: {
          label: t(LABELS.toasts.openInLeanix, locale),
          onClick: openLink,
        },
        duration: 8000,
      });
    } catch (error) {
      let title: string;
      let description: string | undefined;
      let action: { label: string; onClick: () => void } | undefined;

      if (error instanceof LeanixAuthError) {
        title = t(LABELS.toasts.errorAuth, locale);
        description = t(LABELS.toasts.errorAuthDesc, locale);
        action = {
          label: t(LABELS.toasts.openSettings, locale),
          onClick: () => openConfigModal(),
        };
      } else if (error instanceof LeanixServerError) {
        title = t(LABELS.toasts.errorInternal, locale);
        description = t(LABELS.toasts.errorInternalDesc, locale);
      } else if (error instanceof LeanixNetworkError) {
        title = t(LABELS.toasts.errorConnection, locale);
        description = t(LABELS.toasts.errorConnectionDesc, locale);
        action = {
          label: t(LABELS.toasts.retry, locale),
          onClick: handleClick,
        };
      } else {
        title = t(LABELS.toasts.errorConnection, locale);
        description = error instanceof Error ? error.message : undefined;
      }

      showToast({
        type: "error",
        title,
        description,
        action,
        duration: 8000,
      });
    }
  };

  const openConfigModal = () => {
    openModal({
      title: t(LABELS.config.title, locale),
      content: LeanixConfigModal,
      size: "md",
    });
  };

  // Determine button state and tooltip
  let isDisabled = false;
  let tooltip = "";
  let tooltipKey = "";

  if (!isEditMode) {
    isDisabled = true;
    tooltipKey = "toolbar.tooltipReadOnly";
    tooltip = t(LABELS.toolbar.tooltipReadOnly, locale);
  } else if (isLoading) {
    isDisabled = true;
  } else if (!isConfigured) {
    isDisabled = true;
    tooltip = t(LABELS.toolbar.tooltipNoConfig, locale);
  } else {
    // Check if diagram has name
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
        onClick: isDisabled ? undefined : handleClick,
        disabled: isDisabled,
        title: tooltip,
        style: {
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "6px 10px",
          borderRadius: "6px",
          border: "1px solid var(--border)",
          backgroundColor: "var(--card)",
          color: isDisabled ? "var(--muted-foreground)" : "var(--foreground)",
          fontSize: "12px",
          fontWeight: 500,
          cursor: isDisabled ? "not-allowed" : "pointer",
          opacity: isDisabled ? 0.5 : 1,
          transition: "all 0.15s ease",
        },
      },
      React.createElement("span", null, "📤"),
      React.createElement("span", null, t(LABELS.toolbar.button, locale))
    ),
    // Settings button (smaller, secondary)
    React.createElement(
      "button",
      {
        type: "button",
        onClick: openConfigModal,
        title: t(LABELS.config.settings, locale),
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "4px 6px",
          marginLeft: "4px",
          borderRadius: "4px",
          border: "none",
          backgroundColor: "transparent",
          color: "var(--muted-foreground)",
          fontSize: "10px",
          cursor: "pointer",
          transition: "color 0.15s ease",
        },
      },
      isConfigured
        ? React.createElement("span", { title: "Configured" }, "✓")
        : React.createElement("span", { title: "Configure" }, "⚙")
    )
  );
}
