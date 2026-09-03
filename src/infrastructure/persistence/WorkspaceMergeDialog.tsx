import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  FolderOpen,
  XCircle,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Loader2,
  GitMerge,
  FileWarning,
  X,
  Upload,
  Database,
  HardDrive,
} from "lucide-react";
import type { WorkspaceScanResult } from "./FileSystemAdapter";
import { useDiagramStore } from "@/features/diagram";
import { useShallow } from "zustand/react/shallow";

interface WorkspaceMergeDialogProps {
  scanResult: WorkspaceScanResult;
  localDiagramCount: number;
  /** Folder has no diagram JSON files; user may push in-memory diagrams into it. */
  isEmptyFolderPush: boolean;
  /**
   * When true, all action buttons are disabled and show a spinner. Prevents
   * double-clicks during a destructive flush that may take seconds on a
   * large folder, and signals to the user that the operation is in flight.
   */
  isProcessing?: boolean;
  onMerge: () => void;
  onOverwriteLocal: () => void;
  onConfirmEmptyFolderPush: () => void;
  onCancel: () => void;
}

export function WorkspaceMergeDialog({
  scanResult,
  localDiagramCount,
  isEmptyFolderPush,
  isProcessing = false,
  onMerge,
  onOverwriteLocal,
  onConfirmEmptyFolderPush,
  onCancel,
}: WorkspaceMergeDialogProps) {
  const { t } = useTranslation();
  const [showInvalid, setShowInvalid] = useState(false);
  const [showConflictList, setShowConflictList] = useState(false);

  const localDiagramIds = useDiagramStore(useShallow((s) => new Set(Object.keys(s.diagrams))));
  const localDiagrams = useDiagramStore(useShallow((s) => s.diagrams));

  const folderDiagramIds = useMemo(
    () => new Set(scanResult.valid.map((d) => d.id)),
    [scanResult.valid],
  );

  // Classify each diagram into a 3-bucket status: local-only, folder-only, or both.
  const classifiedDiagrams = useMemo(() => {
    const allIds = new Set<string>([...localDiagramIds, ...folderDiagramIds]);
    const rows: Array<{
      id: string;
      name: string;
      status: "local" | "folder" | "both";
    }> = [];
    for (const id of allIds) {
      const inLocal = localDiagramIds.has(id);
      const inFolder = folderDiagramIds.has(id);
      const diagramName =
        (inLocal && localDiagrams[id]?.name) ||
        (inFolder && scanResult.valid.find((d) => d.id === id)?.name) ||
        id;
      rows.push({
        id,
        name: diagramName,
        status: inLocal && inFolder ? "both" : inLocal ? "local" : "folder",
      });
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }, [localDiagramIds, folderDiagramIds, localDiagrams, scanResult.valid]);

  // Numbers that drive the per-button impact copy.
  const localOnlyCount = useMemo(
    () => classifiedDiagrams.filter((d) => d.status === "local").length,
    [classifiedDiagrams],
  );
  const folderOnlyCount = useMemo(
    () => classifiedDiagrams.filter((d) => d.status === "folder").length,
    [classifiedDiagrams],
  );
  const bothCount = useMemo(
    () => classifiedDiagrams.filter((d) => d.status === "both").length,
    [classifiedDiagrams],
  );

  // ----- Hint builders: pick the right copy variant for the current state -----

  const overwriteHintKey = (() => {
    if (localOnlyCount === 0) return "workspaceMerge.overwriteHintNoLoss";
    return "workspaceMerge.overwriteHint";
  })();

  const mergeHintKey =
    folderOnlyCount === 0 ? "workspaceMerge.mergeHintSimple" : "workspaceMerge.mergeHint";

  if (isEmptyFolderPush) {
    return (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-background/60 backdrop-blur-sm h-screen"
        onClick={isProcessing ? undefined : onCancel}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start gap-3 mb-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="h-4.5 w-4.5 text-amber-500" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">{t("workspaceMerge.emptyFolderTitle")}</h2>
              <p className="text-[11px] text-muted-foreground mt-1">
                {t("workspaceMerge.emptyFolderDescription", { count: localDiagramCount })}
              </p>
            </div>
          </div>
          <div className="mb-4 flex items-start gap-2 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-3 py-2">
            <HardDrive className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{t("workspaceMerge.emptyFolderPushHint", { count: localDiagramCount })}</span>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              onClick={onCancel}
              disabled={isProcessing}
              className="rounded-md border border-border px-3 py-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
            >
              <X className="h-3 w-3" />
              {t("workspaceMerge.cancelKeepLocal")}
            </button>
            <button
              onClick={onConfirmEmptyFolderPush}
              disabled={isProcessing}
              className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
              title={t("workspaceMerge.emptyFolderPushTitle")}
            >
              {isProcessing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Upload className="h-3 w-3" />
              )}
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
      onClick={isProcessing ? undefined : onCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {}
        <div className="flex items-start gap-3 mb-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
            <FolderOpen className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">{t("workspaceMerge.title")}</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {t("workspaceMerge.subtitle")}
            </p>
          </div>
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-medium text-emerald-400">
            <HardDrive className="h-3.5 w-3.5" />
            {t("workspaceMerge.valid", { count: scanResult.valid.length })}
          </div>
          {scanResult.invalid.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[11px] font-medium text-red-400">
              <XCircle className="h-3.5 w-3.5" />
              {t("workspaceMerge.invalid", { count: scanResult.invalid.length })}
            </div>
          )}
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground">
            <Database className="h-3.5 w-3.5" />
            {t("workspaceMerge.local", { count: localDiagramCount })}
          </div>
        </div>

        {/* Classification: a compact, scannable breakdown of where each diagram lives. */}
        <div className="mb-4 rounded-md border border-border bg-muted/30 px-3 py-2.5 text-[11px] space-y-1.5">
          <div className="flex items-center gap-2">
            <HardDrive className="h-3 w-3 text-amber-400 shrink-0" />
            <span className="text-muted-foreground">
              {t("workspaceMerge.conflictBadgeFolder")}:
            </span>
            <span className="font-medium">{folderOnlyCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <Database className="h-3 w-3 text-primary shrink-0" />
            <span className="text-muted-foreground">{t("workspaceMerge.conflictBadgeLocal")}:</span>
            <span className="font-medium">{localOnlyCount}</span>
          </div>
          {bothCount > 0 && (
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
              <span className="text-muted-foreground">
                {t("workspaceMerge.conflictBadgeBoth")}:
              </span>
              <span className="font-medium">{bothCount}</span>
            </div>
          )}
        </div>

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
              <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
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
        {scanResult.manifestError && (
          <div className="mb-4 text-[11px] text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-md px-3 py-2">
            <span className="font-medium">{t("workspaceMerge.manifestWarning")}</span>{" "}
            {scanResult.manifestError}
          </div>
        )}
        {bothCount > 0 && (
          <div className="mb-4">
            <button
              onClick={() => setShowConflictList(!showConflictList)}
              className="flex items-center gap-1.5 text-[11px] font-medium text-amber-400 hover:text-amber-300 transition-colors"
            >
              {showConflictList ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              {t("workspaceMerge.conflictDetailsTitle")} ({bothCount})
            </button>
            {showConflictList && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-amber-500/20 bg-amber-500/5 px-2 py-1.5 space-y-0.5">
                <p className="text-[10px] text-muted-foreground px-1 pb-1">
                  {t("workspaceMerge.conflictDetailsHint")}
                </p>
                {classifiedDiagrams
                  .filter((d) => d.status === "both")
                  .map((d) => (
                    <div key={d.id} className="text-[11px] flex items-center gap-2 px-1 py-0.5">
                      <span className="font-mono truncate">{d.name}</span>
                      <span className="ml-auto text-[10px] text-amber-400 shrink-0">
                        {t("workspaceMerge.conflictBadgeBoth")}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Action bar — buttons reordered from safest (left) to most destructive (right).
            Each action has a sub-line below explaining the concrete impact in numbers. */}
        <div className="pt-3 border-t border-border space-y-2">
          <div className="flex items-stretch gap-2">
            <button
              onClick={onCancel}
              disabled={isProcessing}
              className="flex-1 rounded-md border border-border px-3 py-2 text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
              title={t("workspaceMerge.cancelKeepLocalHint")}
            >
              <X className="h-3.5 w-3.5" />
              {t("workspaceMerge.cancelKeepLocal")}
            </button>
            <button
              onClick={onMerge}
              disabled={isProcessing}
              className="flex-1 rounded-md bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
              title={t("workspaceMerge.mergeTitle")}
            >
              {isProcessing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {!isProcessing && <GitMerge className="h-3.5 w-3.5" />}
              {t("workspaceMerge.merge")}
            </button>
            <button
              onClick={onOverwriteLocal}
              disabled={isProcessing}
              className="flex-1 rounded-md border border-destructive/40 px-3 py-2 text-[12px] font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
              title={t("workspaceMerge.overwriteTitle")}
            >
              {isProcessing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {!isProcessing && <FileWarning className="h-3.5 w-3.5" />}
              {t("workspaceMerge.overwrite")}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground leading-snug">
            <p className="px-1">{t("workspaceMerge.cancelKeepLocalHint")}</p>
            <p className="px-1">
              {t(mergeHintKey, {
                keptLocal: localDiagramCount,
                addedFromFolder: folderOnlyCount,
              })}
            </p>
            <p className="px-1 text-destructive/80">
              {t(overwriteHintKey, {
                lostLocal: localOnlyCount,
                keptFromFolder: scanResult.valid.length,
              })}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
