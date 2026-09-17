import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Upload, FileJson, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useWorkspaceImport, type ImportJsonSource } from "@/pages/useWorkspaceImport";
import { ServiceRelinkDialog } from "@/pages/ServiceRelinkDialog";
import type { ImporterContribution } from "@/features/plugins/plugin.types";
import { usePluginIoContributions } from "@/features/plugins/use-plugin-contributions";
import { resolveLocalizedText } from "@/features/plugins/localized-text";
import { runPluginImport } from "@/features/plugins/run-plugin-import";
import { isImportableDiagramFileName } from "@/pages/import-folder-path";

interface ImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetFolderId?: string | null;
  /**
   * Plugin importers merge into the ACTIVE diagram (single undo step), so they are only
   * offered where a diagram is open (model explorer), not on the workspace dashboard.
   */
  allowPluginImporters?: boolean;
}

async function sourcesFromFileList(fileList: FileList | File[]): Promise<ImportJsonSource[]> {
  // Copy before the caller clears `input.value` — FileList is live and becomes empty.
  const files = Array.from(fileList);
  const sources: ImportJsonSource[] = [];
  for (const file of files) {
    if (!isImportableDiagramFileName(file.name)) continue;
    const relativePath = file.webkitRelativePath || undefined;
    sources.push({
      name: file.name,
      text: await file.text(),
      relativePath: relativePath && relativePath.length > 0 ? relativePath : undefined,
    });
  }
  return sources;
}

export function ImportModal({
  open,
  onOpenChange,
  targetFolderId,
  allowPluginImporters = false,
}: ImportModalProps) {
  const { t, i18n } = useTranslation();
  const { importJsonText, importJsonSources, pendingRelinkPlan, confirmRelink, cancelRelink } =
    useWorkspaceImport({
      targetFolderId,
    });
  const { importers } = usePluginIoContributions();
  const pluginImporters = allowPluginImporters ? importers : [];
  const [activeImporter, setActiveImporter] = useState<ImporterContribution | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setActiveImporter(null);
    setIsDragging(false);
  }, [open]);

  useEffect(() => {
    const input = folderInputRef.current;
    if (!input) return;
    input.setAttribute("webkitdirectory", "");
    input.setAttribute("directory", "");
  }, [open]);

  const runImporterForFile = useCallback(
    async (importer: ImporterContribution, file: File): Promise<boolean> => {
      const text = await file.text();
      if (importer.canImport && !importer.canImport(file.name, text)) {
        toast.error(t("plugins.importFailed"));
        return false;
      }
      const outcome = await runPluginImport(importer, text);
      if (!outcome.ok) {
        toast.error(
          outcome.reason === "no-active-diagram"
            ? t("plugins.importNoActiveDiagram")
            : t("plugins.importFailed"),
        );
        return false;
      }
      if (outcome.skippedConnections > 0) {
        toast.warning(t("plugins.importSkippedConnections", { count: outcome.skippedConnections }));
      }
      if (outcome.warnings.length > 0) {
        toast.warning(t("plugins.importWarnings", { warnings: outcome.warnings.join("; ") }));
      }
      toast.success(t("plugins.importSuccess", { count: outcome.importedComponentIds.length }));
      return true;
    },
    [t],
  );

  const handleJsonSources = useCallback(
    async (fileList: FileList | File[]) => {
      const sources = await sourcesFromFileList(fileList);
      if (sources.length === 0) {
        toast.error(t("import.noJsonFiles"));
        return false;
      }
      const result = importJsonSources(sources);
      return result.imported > 0 || result.pendingRelink > 0;
    },
    [importJsonSources, t],
  );

  const handleFile = useCallback(
    async (file: File) => {
      let ok: boolean;
      if (activeImporter) {
        ok = await runImporterForFile(activeImporter, file);
      } else {
        const text = await file.text();
        ok = importJsonText(text);
      }
      if (ok) {
        onOpenChange(false);
      }
    },
    [activeImporter, importJsonText, onOpenChange, runImporterForFile],
  );

  const handleFilesChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const list = event.target.files;
      if (!list || list.length === 0) {
        event.target.value = "";
        return;
      }
      // Snapshot Files before resetting the input — FileList is a live view.
      const files = Array.from(list);
      event.target.value = "";

      if (activeImporter) {
        const file = files[0];
        if (file) void handleFile(file);
        return;
      }

      void handleJsonSources(files).then((ok) => {
        if (ok) onOpenChange(false);
      });
    },
    [activeImporter, handleFile, handleJsonSources, onOpenChange],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragging(false);
      const list = event.dataTransfer.files;
      if (!list || list.length === 0) return;
      const files = Array.from(list);

      if (activeImporter) {
        const file = files[0];
        if (file) void handleFile(file);
        return;
      }

      void handleJsonSources(files).then((ok) => {
        if (ok) onOpenChange(false);
      });
    },
    [activeImporter, handleFile, handleJsonSources, onOpenChange],
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const acceptTypes = activeImporter
    ? activeImporter.extensions.map((extension) => `.${extension}`).join(",")
    : ".json,application/json";

  const hintText = activeImporter
    ? t("plugins.importHint", { extensions: acceptTypes })
    : t("import.hint");

  const hasPlugins = pluginImporters.length > 0;
  const jsonMode = !activeImporter;

  return (
    <>
      {pendingRelinkPlan && (
        <ServiceRelinkDialog
          open
          plan={pendingRelinkPlan}
          onCancel={cancelRelink}
          onConfirm={confirmRelink}
        />
      )}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              {t("import.title")}
            </DialogTitle>
            <DialogDescription>{t("import.description")}</DialogDescription>
          </DialogHeader>

          {hasPlugins && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("import.format")}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setActiveImporter(null)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border p-3 text-left transition-all",
                    !activeImporter
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-primary/50 hover:bg-muted/50",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg",
                      !activeImporter ? "bg-primary text-primary-foreground" : "bg-muted",
                    )}
                  >
                    <FileJson className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t("import.json")}</p>
                    <p className="text-xs text-muted-foreground">.json</p>
                  </div>
                </button>

                {pluginImporters.map((importer) => (
                  <button
                    key={importer.id}
                    type="button"
                    onClick={() => setActiveImporter(importer)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border p-3 text-left transition-all",
                      activeImporter?.id === importer.id
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-primary/50 hover:bg-muted/50",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-lg",
                        activeImporter?.id === importer.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted",
                      )}
                    >
                      <FileJson className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {resolveLocalizedText(importer.label, i18n.language)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {importer.extensions.map((e) => `.${e}`).join(", ")}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">{hintText}</p>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={cn(
              "flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors",
              isDragging ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
            )}
          >
            <Upload className="h-8 w-8 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">{t("import.dropzone")}</p>
            <span className="mt-1 rounded-md bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground">
              {t("import.chooseFiles")}
            </span>
          </button>

          {jsonMode && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => folderInputRef.current?.click()}
            >
              <FolderOpen className="mr-2 h-4 w-4" />
              {t("import.chooseFolder")}
            </Button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={acceptTypes}
            multiple={jsonMode}
            className="hidden"
            tabIndex={-1}
            aria-label={t("import.chooseFiles")}
            onChange={handleFilesChange}
          />
          {jsonMode && (
            <input
              ref={folderInputRef}
              type="file"
              multiple
              className="hidden"
              tabIndex={-1}
              aria-label={t("import.chooseFolder")}
              onChange={handleFilesChange}
            />
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
