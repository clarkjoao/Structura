import type { ReactElement } from "react";
import { LABELS, t } from "../i18n/labels";
import { showToast, getApi, getReact } from "../hooks/usePluginApi";

/**
 * Modal Content Component
 *
 * Demonstrates accessing diagram data and showing toasts from modals.
 */
export function ModalContent({ onClose }: { onClose: () => void }): ReactElement {
  const api = getApi();
  const React = getReact();
  const diagramId = api.getActiveDiagramId();
  const diagram = diagramId ? api.getDiagram(diagramId) : null;

  const handleShowToast = () => {
    showToast({
      type: "success",
      title: t(LABELS.toasts.modalAction, "en"),
      description: t(LABELS.toasts.modalActionDesc, "en"),
    });
  };

  return React.createElement(
    "div",
    { className: "space-y-4" },
    // Info section
    React.createElement(
      "div",
      { className: "rounded-lg bg-muted p-4 space-y-2" },
      React.createElement(
        "h3",
        { className: "font-semibold" },
        diagram ? diagram.name : t(LABELS.modal.noDiagram, "en")
      ),
      React.createElement(
        "p",
        { className: "text-sm text-muted-foreground" },
        diagram
          ? `Components: ${diagram.components.length}, Connections: ${diagram.connections.length}`
          : t(LABELS.modal.openDiagram, "en")
      )
    ),
    // Action buttons
    React.createElement(
      "div",
      { className: "flex gap-2" },
      React.createElement(
        "button",
        {
          type: "button",
          onClick: handleShowToast,
          className: "flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90",
        },
        t(LABELS.modal.showToast, "en")
      ),
      React.createElement(
        "button",
        {
          type: "button",
          onClick: onClose,
          className: "flex-1 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors",
        },
        t(LABELS.modal.close, "en")
      )
    )
  );
}
