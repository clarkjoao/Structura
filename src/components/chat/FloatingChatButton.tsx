import { MessageSquare, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface FloatingChatButtonProps {
  isOpen: boolean;
  onClick: () => void;
  hasUnread?: boolean;
}

export function FloatingChatButton({
  isOpen,
  onClick,
  hasUnread = false,
}: FloatingChatButtonProps) {
  const { t } = useTranslation();
  const tooltipLabel = isOpen
    ? t("llmChat.floatingButton.close")
    : t("llmChat.floatingButton.open");

  return (
    <Button
      type="button"
      size="icon"
      onClick={onClick}
      title={tooltipLabel}
      aria-label={tooltipLabel}
      className="relative h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
    >
      {isOpen ? <X className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
      {hasUnread && !isOpen ? (
        <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-destructive" />
      ) : null}
    </Button>
  );
}
