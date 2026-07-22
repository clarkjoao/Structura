import { LABELS, t } from "../i18n/labels";
import { showToast } from "../hooks/usePluginApi";

interface ModalContentProps {
  onClose: () => void;
  locale: "en" | "pt-BR";
}

/**
 * Content rendered inside a host modal. An ordinary React component — the host wraps it in
 * its dialog chrome (and an error boundary), so it only owns its body.
 */
export function ModalContent({ onClose, locale }: ModalContentProps) {
  const handleShowToast = () => {
    showToast({
      type: "success",
      title: t(LABELS.toasts.modalAction, locale),
      description: t(LABELS.toasts.modalActionDesc, locale),
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-lg bg-muted p-4">
        <h3 className="font-semibold text-foreground">{t(LABELS.modal.title, locale)}</h3>
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
          className="flex-1 rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
        >
          {t(LABELS.modal.close, locale)}
        </button>
      </div>
    </div>
  );
}
