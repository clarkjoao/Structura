import type { ReactElement, MouseEvent } from "react";
import type { PanelContext } from "../types/plugin";
import { LABELS, t } from "../i18n/labels";
import { showToast, openModal, getReact } from "../hooks/usePluginApi";
import { ModalContent } from "./ModalContent";

/**
 * Toolbar Button Component
 *
 * Main entry point for the plugin - renders in the canvas toolbar.
 * Demonstrates toast notifications and modal dialogs.
 */
export function ToolbarButton({ context }: { context: PanelContext }): ReactElement {
  const locale = context?.locale || "en";
  const isEditMode = context?.isEditMode !== false;
  const React = getReact();

  const handleMainClick = () => {
    showToast({
      type: "info",
      title: t(LABELS.toasts.pluginActivated, locale),
      description: t(LABELS.toasts.pluginActivatedDesc, locale),
      duration: 4000,
    });
  };

  const handleShowToasts = (e: MouseEvent) => {
    e.stopPropagation();

    const toastTypes = [
      { type: "success" as const, title: t(LABELS.toasts.success, locale), description: t(LABELS.toasts.successDesc, locale) },
      { type: "error" as const, title: t(LABELS.toasts.error, locale), description: t(LABELS.toasts.errorDesc, locale) },
      { type: "warning" as const, title: t(LABELS.toasts.warning, locale), description: t(LABELS.toasts.warningDesc, locale) },
      { type: "info" as const, title: t(LABELS.toasts.info, locale), description: t(LABELS.toasts.infoDesc, locale) },
    ];

    toastTypes.forEach((toast, index) => {
      setTimeout(() => showToast(toast), index * 600);
    });
  };

  const handleShowActionToast = (e: MouseEvent) => {
    e.stopPropagation();

    showToast({
      type: "success",
      title: t(LABELS.toasts.actionAvailable, locale),
      description: t(LABELS.toasts.actionAvailableDesc, locale),
      action: {
        label: t(LABELS.toasts.doSomething, locale),
        onClick: () => {
          showToast({
            type: "info",
            title: t(LABELS.toasts.actionExecuted, locale),
            duration: 2000,
          });
        },
      },
      duration: 8000,
    });
  };

  const handleOpenModal = (e: MouseEvent) => {
    e.stopPropagation();

    openModal({
      title: t(LABELS.modal.title, locale),
      content: ModalContent,
      size: "md",
    });
  };

  if (!isEditMode) {
    return React.createElement(
      "button",
      {
        type: "button",
        disabled: true,
        className: "flex items-center gap-1.5 rounded-lg border border-border bg-card/90 backdrop-blur-sm px-3 py-2 text-xs font-medium text-muted-foreground opacity-50 cursor-not-allowed",
        title: t(LABELS.toolbar.readOnly, locale),
      },
      React.createElement("span", null, "🔌"),
      React.createElement("span", null, t(LABELS.toolbar.button, locale))
    );
  }

  return React.createElement(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: "4px" } },
    // Main button
    React.createElement(
      "button",
      {
        type: "button",
        onClick: handleMainClick,
        className: "flex items-center gap-1.5 rounded-lg border border-border bg-card/90 backdrop-blur-sm px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors",
      },
      React.createElement("span", null, "🔌"),
      React.createElement("span", null, t(LABELS.toolbar.button, locale))
    ),
    // Sub-buttons container
    React.createElement(
      "div",
      { style: { display: "flex", gap: "4px", marginLeft: "16px" } },
      React.createElement(
        "button",
        {
          type: "button",
          onClick: handleShowToasts,
          className: "text-xs px-2 py-1 rounded bg-secondary/50 hover:bg-secondary transition-colors",
        },
        t(LABELS.toolbar.toasts, locale)
      ),
      React.createElement(
        "button",
        {
          type: "button",
          onClick: handleShowActionToast,
          className: "text-xs px-2 py-1 rounded bg-secondary/50 hover:bg-secondary transition-colors",
        },
        t(LABELS.toolbar.action, locale)
      ),
      React.createElement(
        "button",
        {
          type: "button",
          onClick: handleOpenModal,
          className: "text-xs px-2 py-1 rounded bg-secondary/50 hover:bg-secondary transition-colors",
        },
        t(LABELS.toolbar.modal, locale)
      )
    )
  );
}
