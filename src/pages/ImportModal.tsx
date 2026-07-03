import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Upload } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useWorkspaceImport } from "@/pages/useWorkspaceImport";
import type { ImporterContribution } from "@/features/plugins/plugin.types";
import { usePluginIoContributions } from "@/features/plugins/use-plugin-contributions";
import { resolveLocalizedText } from "@/features/plugins/localized-text";
import { runPluginImport } from "@/features/plugins/run-plugin-import";

type ImportModalTab = "json" | "structurizr" | `plugin:${string}`;

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

export function ImportModal({
  open,
  onOpenChange,
  targetFolderId,
  allowPluginImporters = false,
}: ImportModalProps) {
  const { t, i18n } = useTranslation();
  const { importJsonText, importDslText } = useWorkspaceImport({
    targetFolderId,
  });
  const { importers } = usePluginIoContributions();
  const pluginImporters = allowPluginImporters ? importers : [];
  const [tab, setTab] = useState<ImportModalTab>("json");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTab("json");
    setIsDragging(false);
  }, [open]);

  const activeImporter: ImporterContribution | undefined = tab.startsWith("plugin:")
    ? pluginImporters.find((importer) => `plugin:${importer.id}` === tab)
    : undefined;

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

  const runImportForTab = useCallback(
    async (file: File) => {
      let ok: boolean;
      if (activeImporter) {
        ok = await runImporterForFile(activeImporter, file);
      } else {
        const text = await file.text();
        ok = tab === "json" ? importJsonText(text) : importDslText(text);
      }
      if (ok) {
        onOpenChange(false);
      }
    },
    [activeImporter, importDslText, importJsonText, onOpenChange, runImporterForFile, tab],
  );

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      void runImportForTab(file);
    },
    [runImportForTab],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragging(false);
      const file = event.dataTransfer.files?.[0];
      if (!file) return;
      void runImportForTab(file);
    },
    [runImportForTab],
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const acceptForTab = activeImporter
    ? activeImporter.extensions.map((extension) => `.${extension}`).join(",")
    : tab === "json"
      ? ".json,application/json"
      : ".dsl,.txt";

  const hintForTab = activeImporter
    ? t("plugins.importHint", { extensions: acceptForTab })
    : tab === "json"
      ? t("import.modal.jsonHint")
      : t("import.modal.structurizrHint");

  const tabColumns = 2 + pluginImporters.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("import.modal.title")}</DialogTitle>
          <DialogDescription>{t("import.modal.description")}</DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as ImportModalTab)}
          className="w-full"
        >
          <TabsList
            className="grid w-full"
            style={{ gridTemplateColumns: `repeat(${tabColumns}, minmax(0, 1fr))` }}
          >
            <TabsTrigger value="json">{t("import.modal.jsonTab")}</TabsTrigger>
            <TabsTrigger value="structurizr">{t("import.modal.structurizrTab")}</TabsTrigger>
            {pluginImporters.map((importer) => (
              <TabsTrigger key={importer.id} value={`plugin:${importer.id}`}>
                {resolveLocalizedText(importer.label, i18n.language)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <p className="mt-4 text-xs text-muted-foreground">{hintForTab}</p>

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
          <p className="text-sm text-muted-foreground">{t("import.modal.dropzone")}</p>
          <span className="mt-1 rounded-md bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground">
            {t("import.modal.chooseFile")}
          </span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept={acceptForTab}
          className="hidden"
          tabIndex={-1}
          aria-label={t("import.modal.chooseFile")}
          onChange={handleFileChange}
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
