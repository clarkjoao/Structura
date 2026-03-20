import { useCallback } from "react";
import { Eye } from "lucide-react";
import { useTranslation } from "react-i18next";

interface EmbedButtonProps {
  elementId: string;
  onEmbed?: (id: string) => void;
  disabled?: boolean;
}

export const EmbedButton = ({
  elementId,
  onEmbed,
  disabled,
}: EmbedButtonProps) => {
  const { t } = useTranslation();
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onEmbed?.(elementId);
    },
    [elementId, onEmbed],
  );
  if (!onEmbed) return null;
  return (
    <button
      onClick={handleClick}
      className={`mt-1 flex items-center gap-1 text-[10px] font-medium text-muted-foreground ${
        disabled
          ? "pointer-events-none"
          : "hover:text-foreground hover:underline"
      }`}
      tabIndex={disabled ? -1 : 0}
    >
      <Eye className="h-3 w-3" /> {t("customNode.embedDiagram")}
    </button>
  );
};
