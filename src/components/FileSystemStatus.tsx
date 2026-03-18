import { FolderOpen, FolderX, Loader2, HardDrive, Database } from "lucide-react";
import {
  useFileSystemStorage,
  isFileSystemSupported,
} from "@/infrastructure/persistence/useFileSystemStorage";
import { WorkspaceMergeDialog } from "@/infrastructure/persistence/WorkspaceMergeDialog";
import { DisconnectConfirmDialog } from "@/infrastructure/persistence/DisconnectConfirmDialog";
import { useDiagramStore } from "@/features/diagram";
import { useShallow } from "zustand/react/shallow";

export function FileSystemStatus() {
  const {
    status,
    folderName,
    connect,
    requestDisconnect,
    confirmDisconnectWithBackup,
    confirmDisconnectWithoutBackup,
    cancelDisconnect,
    pendingDisconnect,
    scanResult,
    pendingMerge,
    confirmMerge,
    confirmOverwrite,
    cancelMerge,
  } = useFileSystemStorage();

  const localDiagramCount = useDiagramStore(
    useShallow((s) => Object.keys(s.diagrams).length)
  );

  if (!isFileSystemSupported) return null;

  return (
    <>
      {status === "connected" && !pendingMerge && (
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 rounded-md border border-emerald-500/30
            bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-medium text-emerald-400"
          >
            <HardDrive className="h-3.5 w-3.5" />
            <span>Pasta local</span>
            {folderName && (
              <span className="text-emerald-400/70 font-mono truncate max-w-[120px]">
                {folderName}
              </span>
            )}
          </div>
          <button
            onClick={requestDisconnect}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Desconectar pasta"
          >
            <FolderX className="h-4 w-4" />
          </button>
        </div>
      )}

      {status === "connecting" && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Conectando...
        </div>
      )}

      {status === "disconnected" && (
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 rounded-md border border-amber-500/30
              bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-medium text-amber-400"
            title="Dados salvos no navegador (localStorage)"
          >
            <Database className="h-3.5 w-3.5" />
            <span>localStorage</span>
          </div>
          <button
            onClick={connect}
            className="flex items-center gap-1.5 rounded-md border border-border
              px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground
              hover:text-foreground hover:border-primary/40 transition-all"
            title="Sincronizar com pasta local"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Conectar pasta
          </button>
        </div>
      )}

      {pendingMerge && scanResult && (
        <WorkspaceMergeDialog
          scanResult={scanResult}
          localDiagramCount={localDiagramCount}
          onMerge={confirmMerge}
          onOverwriteLocal={confirmOverwrite}
          onCancel={cancelMerge}
        />
      )}

      {pendingDisconnect && (
        <DisconnectConfirmDialog
          folderName={folderName}
          onKeepCopy={confirmDisconnectWithBackup}
          onDisconnectOnly={confirmDisconnectWithoutBackup}
          onCancel={cancelDisconnect}
        />
      )}
    </>
  );
}
