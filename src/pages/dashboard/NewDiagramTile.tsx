import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

interface NewDiagramTileProps {
  onClick: () => void;
}

export function NewDiagramTile({ onClick }: NewDiagramTileProps) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[260px] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card/40 text-muted-foreground transition-all hover:border-primary/40 hover:bg-muted/30 hover:text-foreground"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-current/40">
        <Plus className="h-5 w-5" />
      </div>
      <span className="text-sm font-medium">{t("dashboard.newDiagram")}</span>
    </button>
  );
}
