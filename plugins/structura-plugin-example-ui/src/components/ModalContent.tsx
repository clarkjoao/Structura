import type { ReactElement } from "react";
import { LABELS, t } from "../i18n/labels";
import { showToast, getReact } from "../hooks/usePluginApi";

/**
 * Factory function to create ModalContent component
 * This pattern allows using React hooks while getting React from the host
 */
export function createModalContent({ onClose }: { onClose: () => void }): ReactElement {
  const React = getReact();
  const locale = "en";

  const handleShowToast = () => {
    showToast({
      type: "success",
      title: t(LABELS.toasts.modalAction, locale),
      description: t(LABELS.toasts.modalActionDesc, locale),
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-muted p-4 space-y-2">
        <h3 className="font-semibold">{t(LABELS.modal.title, locale)}</h3>
        <p className="text-sm text-muted-foreground">
          This modal demonstrates how to show toast notifications and interact with the diagram API.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleShowToast}
          className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t(LABELS.modal.showToast, locale)}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
        >
          {t(LABELS.modal.close, locale)}
        </button>
      </div>
    </div>
  );
}

/**
 * Modal Content Component - wrapper for backwards compatibility
 */
export function ModalContent(props: { onClose: () => void }): ReactElement {
  return createModalContent(props);
}
