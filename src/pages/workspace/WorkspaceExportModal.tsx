import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Download, FileCode, FileImage, FileJson, Loader2 } from "lucide-react";
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
import {
  buildWorkspaceExportFiles,
  downloadZip,
  planWorkspaceExport,
  type DiagramExportFormat,
} from "@/lib/export-service";
import type { Diagram, Folder, ServiceDefinition } from "@/features/diagram";
import {
  defaultExportScope,
  diagramsForScope,
  type WorkspaceExportScope,
} from "@/pages/workspace/workspaceExportScope";

export interface WorkspaceExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diagrams: Diagram[];
  folders: Record<string, Folder>;
  services: Record<string, ServiceDefinition>;
  selectedIds: ReadonlySet<string>;
  selectedFolderId: string | null;
}

const SCOPES: WorkspaceExportScope[] = ["selected", "folder", "workspace"];
const DEFAULT_FORMATS: DiagramExportFormat[] = ["json", "drawio"];
const PREVIEW_LIMIT = 20;

export function WorkspaceExportModal({
  open,
  onOpenChange,
  diagrams,
  folders,
  services,
  selectedIds,
  selectedFolderId,
}: WorkspaceExportModalProps) {
  const { t } = useTranslation();
  const [scope, setScope] = useState<WorkspaceExportScope>("workspace");
  const [formats, setFormats] = useState<ReadonlySet<DiagramExportFormat>>(
    () => new Set(DEFAULT_FORMATS),
  );
  const [exporting, setExporting] = useState(false);

  const diagramsByScope = useMemo(() => {
    const input = { diagrams, folders, selectedIds, selectedFolderId };
    return {
      selected: diagramsForScope("selected", input),
      folder: diagramsForScope("folder", input),
      workspace: diagramsForScope("workspace", input),
    } satisfies Record<WorkspaceExportScope, Diagram[]>;
  }, [diagrams, folders, selectedIds, selectedFolderId]);

  const counts = useMemo(
    () => ({
      selected: diagramsByScope.selected.length,
      folder: diagramsByScope.folder.length,
      workspace: diagramsByScope.workspace.length,
    }),
    [diagramsByScope],
  );

  // Pick the scope once per opening; later selection changes must not yank it.
  useEffect(() => {
    if (!open) return;
    setScope(defaultExportScope(counts));
    setFormats(new Set(DEFAULT_FORMATS));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset on open only
  }, [open]);

  const scopeDiagrams = diagramsByScope[scope];
  const orderedFormats = useMemo(
    () => (["json", "drawio", "mermaid"] as const).filter((format) => formats.has(format)),
    [formats],
  );

  const plannedFiles = useMemo(
    () => planWorkspaceExport({ diagrams: scopeDiagrams, formats: orderedFormats, folders }),
    [scopeDiagrams, orderedFormats, folders],
  );

  const toggleFormat = (format: DiagramExportFormat) => {
    setFormats((prev) => {
      const next = new Set(prev);
      if (next.has(format)) next.delete(format);
      else next.add(format);
      return next;
    });
  };

  const canExport = plannedFiles.length > 0 && !exporting;

  const handleExport = async () => {
    if (!canExport) return;
    setExporting(true);
    try {
      const files = buildWorkspaceExportFiles({
        diagrams: scopeDiagrams,
        formats: orderedFormats,
        services,
        folders,
      });
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      await downloadZip(files, `export-${timestamp}.zip`);
      toast.success(t("export.workspace.success", { count: files.length }));
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("export.workspace.error"));
    } finally {
      setExporting(false);
    }
  };

  const scopeLabels: Record<WorkspaceExportScope, string> = {
    selected: t("export.workspace.scopeSelected"),
    folder: t("export.workspace.scopeFolder"),
    workspace: t("export.workspace.scopeWorkspace"),
  };

  const formatOptions = [
    {
      format: "json" as const,
      icon: FileJson,
      title: t("export.options.json.title"),
      description: t("export.options.json.description"),
    },
    {
      format: "drawio" as const,
      icon: FileImage,
      title: t("export.options.drawio.title"),
      description: t("export.options.drawio.description"),
    },
    {
      format: "mermaid" as const,
      icon: FileCode,
      title: t("export.options.mermaid.title"),
      description: t("export.workspace.mermaidNote"),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            {t("export.workspace.title")}
          </DialogTitle>
          <DialogDescription>{t("export.workspace.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div
            className="space-y-2"
            role="radiogroup"
            aria-label={t("export.workspace.scopeLabel")}
          >
            <p className="text-sm font-medium">{t("export.workspace.scopeLabel")}</p>
            {SCOPES.map((value) => {
              const count = counts[value];
              const active = scope === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={count === 0}
                  onClick={() => setScope(value)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all",
                    active
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-primary/50 hover:bg-muted/50",
                    "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-transparent",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                      active ? "border-primary bg-primary" : "border-muted-foreground/30",
                    )}
                  >
                    {active && <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />}
                  </span>
                  <span className="flex-1 text-sm">{scopeLabels[value]}</span>
                  <span className="text-xs text-muted-foreground">
                    {count} {t(count === 1 ? "common.diagram_one" : "common.diagram_other")}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">{t("export.workspace.formatLabel")}</p>
            {formatOptions.map(({ format, icon: Icon, title, description }) => {
              const active = formats.has(format);
              return (
                <button
                  key={format}
                  type="button"
                  role="checkbox"
                  aria-checked={active}
                  onClick={() => toggleFormat(format)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all",
                    active
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-primary/50 hover:bg-muted/50",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                      active ? "bg-primary text-primary-foreground" : "bg-muted",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{title}</span>
                    <span className="block text-xs text-muted-foreground">{description}</span>
                  </span>
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded",
                      active ? "bg-primary text-primary-foreground" : "bg-muted",
                    )}
                  >
                    {active && <Check className="h-3 w-3" strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">
              {t("export.workspace.previewLabel")} ({plannedFiles.length}{" "}
              {t(plannedFiles.length === 1 ? "common.file_one" : "common.file_other")})
            </p>
            <div className="max-h-40 overflow-y-auto rounded-lg border bg-muted/30 p-3 font-mono text-xs">
              {plannedFiles.length === 0 ? (
                <span className="italic text-muted-foreground">
                  {orderedFormats.length === 0
                    ? t("export.workspace.noFormats")
                    : t("export.workspace.noDiagrams")}
                </span>
              ) : (
                <ul className="space-y-1">
                  {plannedFiles.slice(0, PREVIEW_LIMIT).map((file) => (
                    <li key={file.filename} className="truncate" title={file.filename}>
                      {file.filename}
                    </li>
                  ))}
                  {plannedFiles.length > PREVIEW_LIMIT && (
                    <li className="text-muted-foreground">
                      {t("common.andMore", { count: plannedFiles.length - PREVIEW_LIMIT })}
                    </li>
                  )}
                </ul>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void handleExport()} disabled={!canExport} className="gap-2">
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {t("export.workspace.exportButton")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
