import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Upload } from "lucide-react";
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

type ImportModalTab = "json" | "structurizr";

interface ImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetFolderId?: string | null;
}

export function ImportModal({ open, onOpenChange, targetFolderId }: ImportModalProps) {
  const { t } = useTranslation();
  const { importJsonText, importDslText } = useWorkspaceImport({
    targetFolderId,
  });
  const [tab, setTab] = useState<ImportModalTab>("json");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTab("json");
    setIsDragging(false);
  }, [open]);

  const runImportForTab = useCallback(
    async (file: File) => {
      const text = await file.text();
      const ok = tab === "json" ? importJsonText(text) : importDslText(text);
      if (ok) {
        onOpenChange(false);
      }
    },
    [importDslText, importJsonText, onOpenChange, tab],
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

  const acceptForTab = tab === "json" ? ".json,application/json" : ".dsl,.txt";

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
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="json">{t("import.modal.jsonTab")}</TabsTrigger>
            <TabsTrigger value="structurizr">{t("import.modal.structurizrTab")}</TabsTrigger>
          </TabsList>
        </Tabs>

        <p className="mt-4 text-xs text-muted-foreground">
          {tab === "json" ? t("import.modal.jsonHint") : t("import.modal.structurizrHint")}
        </p>

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
