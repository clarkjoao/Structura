import { Button, Card, Stack } from "@structura/ui";
import { LABELS, t } from "../i18n/labels";
import { showToast } from "../hooks/usePluginApi";

interface ModalContentProps {
  onClose: () => void;
  locale: "en" | "pt-BR";
}

/**
 * Content rendered inside a host modal. An ordinary React component — the host wraps it in
 * its dialog chrome (and an error boundary), so it only owns its body, drawn with the host's
 * components (`@structura/ui`).
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
    <Stack gap={4}>
      <Card
        title={t(LABELS.modal.title, locale)}
        description="This modal demonstrates how to show toast notifications and interact with the diagram API."
      />
      <Stack direction="row" gap={2}>
        <Button style={{ flex: 1 }} onClick={handleShowToast}>
          {t(LABELS.modal.showToast, locale)}
        </Button>
        <Button style={{ flex: 1 }} variant="outline" onClick={onClose}>
          {t(LABELS.modal.close, locale)}
        </Button>
      </Stack>
    </Stack>
  );
}
