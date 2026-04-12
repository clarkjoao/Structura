import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  FolderOpen,
  CheckCircle2,
  XCircle,
  FileBox,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import type { WorkspaceScanResult } from "./FileSystemAdapter";
import { useDiagramStore } from "@/features/diagram";
import { useShallow } from "zustand/react/shallow";

interface WorkspaceMergeDialogProps {
  scanResult: WorkspaceScanResult;
  localDiagramCount: number;
  /** Folder has no diagram JSON files; user may push in-memory diagrams into it. */
  isEmptyFolderPush: boolean;
  onMerge: () => void;
  onOverwriteLocal: () => void;
  onConfirmEmptyFolderPush: () => void;
  onCancel: () => void;
}

export function WorkspaceMergeDialog({
  scanResult,
  localDiagramCount,
  isEmptyFolderPush,
  onMerge,
  onOverwriteLocal,
  onConfirmEmptyFolderPush,
  onCancel,
}: WorkspaceMergeDialogProps) {
  const { t } = useTranslation();
  const [showInvalid, setShowInvalid] = useState(false);

  const localDiagramIds = useDiagramStore(
    useShallow((s) => new Set(Object.keys(s.diagrams)))
  );

  const conflictCount = useMemo(
    () => scanResult.valid.filter((d) => localDiagramIds.has(d.id)).length,
    [scanResult.valid, localDiagramIds]
  );

  if (isEmptyFolderPush) {
    return (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-background/60 backdrop-blur-sm h-screen"
        onClick={onCancel}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="h-4.5 w-4.5 text-amber-500" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">{t("workspaceMerge.emptyFolderTitle")}</h2>
              <p className="text-[11px] text-muted-foreground mt-1">
                {t("workspaceMerge.emptyFolderDescription", { count: localDiagramCount })}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              onClick={onCancel}
              className="rounded-md border border-border px-3 py-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              {t("workspaceMerge.cancelKeepLocal")}
            </button>
            <button
              onClick={onConfirmEmptyFolderPush}
              className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              title={t("workspaceMerge.emptyFolderPushTitle")}
            >
              {t("workspaceMerge.emptyFolderPush")}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-background/60 backdrop-blur-sm h-screen"
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
            <FolderOpen className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">
              {t("workspaceMerge.title")}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {t("workspaceMerge.found", { count: scanResult.valid.length })}
            </p>
          </div>
        </div>

        {}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-medium text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t("workspaceMerge.valid", { count: scanResult.valid.length })}
          </div>
          {scanResult.invalid.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[11px] font-medium text-red-400">
              <XCircle className="h-3.5 w-3.5" />
              {t("workspaceMerge.invalid", { count: scanResult.invalid.length })}
            </div>
          )}
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground">
            <FileBox className="h-3.5 w-3.5" />
            {t("workspaceMerge.local", { count: localDiagramCount })}
          </div>
        </div>

        {}
        {scanResult.invalid.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => setShowInvalid(!showInvalid)}
              className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {showInvalid ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              {t("workspaceMerge.toggleInvalid", { count: scanResult.invalid.length })}
            </button>
            {showInvalid && (
              <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                {scanResult.invalid.map((inv, i) => (
                  <div
                    key={i}
                    className="text-[11px] font-mono text-destructive bg-destructive/5 rounded px-2 py-1"
                  >
                    <span className="font-semibold">{inv.fileName}</span>
                    {" — "}
                    {inv.reason}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {}
        {scanResult.manifestError && (
          <div className="mb-4 text-[11px] text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-md px-3 py-2">
            <span className="font-medium">{t("workspaceMerge.manifestWarning")}</span>{" "}
            {scanResult.manifestError}
          </div>
        )}

        {}
        {conflictCount > 0 && (
          <div className="mb-4 flex items-start gap-2 text-[11px] text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-md px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              {t("workspaceMerge.conflict", { count: conflictCount })}
            </span>
          </div>
        )}

        {}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <button
            onClick={onCancel}
            className="rounded-md border border-border px-3 py-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            {t("workspaceMerge.cancelKeepLocal")}
          </button>
          <button
            onClick={onOverwriteLocal}
            className="rounded-md border border-destructive/40 px-3 py-1.5 text-[12px] font-medium text-destructive hover:bg-destructive/10 transition-colors"
            title={t("workspaceMerge.overwriteTitle")}
          >
            {t("workspaceMerge.overwrite")}
          </button>
          <button
            onClick={onMerge}
            className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            title={t("workspaceMerge.mergeTitle")}
          >
            {t("workspaceMerge.merge")}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
