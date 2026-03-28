import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { Diagram } from "@/features/diagram";
import { useDiagramActions } from "@/features/diagram";
import { CollabStatusIndicator } from "./CollabStatusIndicator";
import { CollabToolbar } from "./CollabToolbar";
import { useCollab } from "./CollabProvider";

interface CollabRoomToolbarProps {
  diagram: Diagram | null;
}

export function CollabRoomToolbar({ diagram }: CollabRoomToolbarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { session, isReady, status, collabUrl, peerLimitReached, closeSession } = useCollab();
  const { importDiagram } = useDiagramActions();
  const [isImporting, setIsImporting] = useState(false);
  const isHost = session?.isHost ?? false;

  const handleImportDiagram = () => {
    if (!diagram) return;
    setIsImporting(true);
    try {
      const hostName = session?.localUser?.name ?? "collab";
      const importedDiagram = importDiagram({
        ...diagram,
        name: t("collaboration.importedDiagramName", {
          name: diagram.name,
          host: hostName,
        }),
      });
      toast.success(t("collaboration.importSuccess", { name: importedDiagram.name }));
      navigate(`/model/${importedDiagram.id}`);
    } catch {
      toast.error(t("collaboration.importError"));
    } finally {
      setIsImporting(false);
    }
  };

  const handleCloseSession = () => {
    if (!window.confirm(t("collaboration.confirmClose"))) return;
    closeSession();
    navigate("/workspace");
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card/80 backdrop-blur-sm shrink-0">
      <button
        type="button"
        onClick={() => navigate("/workspace")}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t("collaboration.backToWorkspace")}
      </button>

      <div className="h-4 w-px bg-border mx-1" />

      {diagram && (
        <span className="text-xs font-medium text-foreground truncate max-w-[200px]">
          {diagram.name}
        </span>
      )}

      <div className="h-4 w-px bg-border mx-1" />
      <CollabStatusIndicator status={status} />

      <div className="flex-1" />

      {!isHost && diagram && (
        <button
          type="button"
          onClick={handleImportDiagram}
          disabled={isImporting || !isReady}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card/90 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors disabled:opacity-50 disabled:pointer-events-none"
          title={t("collaboration.importToWorkspace")}
        >
          <Download className="h-3.5 w-3.5" />
          {t("collaboration.importToWorkspace")}
        </button>
      )}

      <CollabToolbar
        session={session}
        isReady={isReady}
        collabUrl={collabUrl}
        peerLimitReached={peerLimitReached}
        onStartCollab={() => {}}
        onEndCollab={isHost ? handleCloseSession : undefined}
      />
    </div>
  );
}
