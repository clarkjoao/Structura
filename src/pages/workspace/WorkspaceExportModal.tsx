import React, { useCallback, useMemo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, FileJson, FileImage } from "lucide-react";
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
import { buildWorkspaceExportFiles, downloadZip, type DiagramExportFormat } from "@/lib/export-service";
import type { Diagram, Folder, ServiceDefinition } from "@/features/diagram";
import { toast } from "sonner";

export interface WorkspaceExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diagrams: Diagram[];
  folders: Record<string, Folder>;
  services: Record<string, ServiceDefinition>;
  selectedIds: Set<string>;
  selectedFolderId: string | null;
}

type ExportScope = "selected" | "folder" | "workspace";

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function getFolderPrefix(
  folderId: string | null | undefined,
  folders: Record<string, Folder>,
): string {
  if (!folderId) return "";
  const parts: string[] = [];
  let currentId: string | null | undefined = folderId;
  while (currentId) {
    const folder: Folder | undefined = folders[currentId];
    if (!folder) break;
    parts.unshift(sanitizeFilename(folder.name));
    currentId = folder.parentId;
  }
  return parts.join("-");
}

function getDiagramsInFolder(
  folderId: string | null,
  diagrams: Diagram[],
  folders: Record<string, Folder>,
): Diagram[] {
  // Direct diagrams in folder
  const direct = diagrams.filter((d) => d.folderId === folderId);

  // Recursively get subfolder IDs
  function getSubfolderIds(parentId: string | null): string[] {
    const children = Object.values(folders).filter((f) => f.parentId === parentId);
    const childIds = children.map((c) => c.id);
    const nested = children.flatMap((c) => getSubfolderIds(c.id));
    return [...childIds, ...nested];
  }

  const allFolderIds = [folderId, ...getSubfolderIds(folderId)].filter(Boolean) as string[];
  const nested = diagrams.filter(
    (d) => allFolderIds.includes(d.folderId ?? "") && d.folderId !== folderId,
  );

  return [...direct, ...nested];
}

function buildPreviewFilename(diagram: Diagram, folders: Record<string, Folder>): string {
  const prefix = getFolderPrefix(diagram.folderId, folders);
  const name = sanitizeFilename(diagram.name);
  return prefix ? `${prefix}_${name}` : name;
}

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

  // Scope state
  const [scope, setScope] = useState<ExportScope>("workspace");

  // Format state
  const [selectedFormats, setSelectedFormats] = useState<Set<DiagramExportFormat>>(
    new Set(["json", "drawio"]),
  );

  // Reset state when modal opens
  useEffect(() => {
    if (!open) return;
    setScope("workspace");
    setSelectedFormats(new Set(["json", "drawio"]));
  }, [open]);

  // Compute diagrams for each scope
  const scopeDiagrams = useMemo(() => {
    switch (scope) {
      case "selected":
        return diagrams.filter((d) => selectedIds.has(d.id));
      case "folder":
        return getDiagramsInFolder(selectedFolderId, diagrams, folders);
      case "workspace":
      default:
        return diagrams;
    }
  }, [scope, diagrams, selectedIds, selectedFolderId, folders]);

  // Build preview filenames
  const previewFiles = useMemo(() => {
    const files: Array<{ name: string; format: DiagramExportFormat }> = [];
    for (const diagram of scopeDiagrams) {
      const baseName = buildPreviewFilename(diagram, folders);
      for (const format of selectedFormats) {
        const ext = format === "mermaid" ? "md" : format === "drawio" ? "drawio" : "json";
        const suffix = format === "mermaid" ? "-flows" : "";
        files.push({ name: `${baseName}${suffix}.${ext}`, format });
      }
    }
    return files;
  }, [scopeDiagrams, selectedFormats, folders]);

  const toggleFormat = (format: DiagramExportFormat) => {
    setSelectedFormats((prev) => {
      const next = new Set(prev);
      if (next.has(format)) {
        next.delete(format);
      } else {
        next.add(format);
      }
      return next;
    });
  };

  const handleExport = useCallback(async () => {
    if (scopeDiagrams.length === 0 || selectedFormats.size === 0) return;

    try {
      const files = buildWorkspaceExportFiles({
        diagrams: scopeDiagrams,
        formats: Array.from(selectedFormats),
        services,
        folders,
      });

      const timestamp = new Date().toISOString().slice(0, 10);
      await downloadZip(files, `export-${timestamp}.zip`);
      toast.success(t("export.workspace.success", { count: files.length }));
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("export.workspace.error"));
    }
  }, [scopeDiagrams, selectedFormats, services, folders, onOpenChange, t]);

  const scopeOptions: Array<{ value: ExportScope; label: string; count: number }> = [
    {
      value: "selected",
      label: t("export.workspace.scopeSelected", { count: selectedIds.size }),
      count: selectedIds.size,
    },
    {
      value: "folder",
      label: t("export.workspace.scopeFolder", {
        count: getDiagramsInFolder(selectedFolderId, diagrams, folders).length,
      }),
      count: getDiagramsInFolder(selectedFolderId, diagrams, folders).length,
    },
    {
      value: "workspace",
      label: t("export.workspace.scopeWorkspace", { count: diagrams.length }),
      count: diagrams.length,
    },
  ];

  const formatOptions: Array<{
    format: DiagramExportFormat;
    icon: typeof FileJson;
    title: string;
    description: string;
    defaultSelected: boolean;
  }> = [
    {
      format: "json",
      icon: FileJson,
      title: t("export.options.json.title"),
      description: t("export.options.json.description"),
      defaultSelected: true,
    },
    {
      format: "drawio",
      icon: FileImage,
      title: t("export.options.drawio.title"),
      description: t("export.options.drawio.description"),
      defaultSelected: true,
    },
    {
      format: "mermaid",
      icon: FileJson,
      title: t("export.options.mermaid.title"),
      description: t("export.workspace.mermaidNote"),
      defaultSelected: false,
    },
  ];

  const canExport = scopeDiagrams.length > 0 && selectedFormats.size > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            {t("export.workspace.title")}
          </DialogTitle>
          <DialogDescription>{t("export.workspace.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Scope Selection */}
          <div className="space-y-3">
            <p className="text-sm font-medium">{t("export.workspace.scopeLabel")}</p>
            <div className="space-y-2">
              {scopeOptions.map(({ value, label, count }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setScope(value)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all",
                    scope === value
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-primary/50 hover:bg-muted/50",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full border-2",
                      scope === value
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/30",
                    )}
                  >
                    {scope === value && (
                      <div className="h-2 w-2 rounded-full bg-primary-foreground" />
                    )}
                  </div>
                  <span className="flex-1 text-sm">{label}</span>
                  <span className="text-xs text-muted-foreground">
                    {count} {count === 1 ? t("common.diagram_one") : t("common.diagram_other")}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Format Selection */}
          <div className="space-y-3">
            <p className="text-sm font-medium">{t("export.workspace.formatLabel")}</p>
            <div className="space-y-2">
              {formatOptions.map(({ format, icon: Icon, title, description }) => (
                <button
                  key={format}
                  type="button"
                  onClick={() => toggleFormat(format)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all",
                    selectedFormats.has(format)
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-primary/50 hover:bg-muted/50",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg",
                      selectedFormats.has(format) ? "bg-primary text-primary-foreground" : "bg-muted",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{title}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                  <div
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded",
                      selectedFormats.has(format) ? "bg-primary text-primary-foreground" : "bg-muted",
                    )}
                  >
                    {selectedFormats.has(format) ? (
                      <svg
                        className="h-3 w-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <p className="text-sm font-medium">
              {t("export.workspace.previewLabel")} ({previewFiles.length}{" "}
              {previewFiles.length === 1 ? t("common.file_one") : t("common.file_other")})
            </p>
            <div
              className={cn(
                "rounded-lg border bg-muted/30 p-3 font-mono text-xs",
                previewFiles.length === 0 && "text-muted-foreground italic",
              )}
            >
              {previewFiles.length === 0 ? (
                t("export.workspace.noDiagrams")
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {previewFiles.slice(0, 20).map((file, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-muted-foreground">{file.format}</span>
                      <span className="truncate">{file.name}</span>
                    </div>
                  ))}
                  {previewFiles.length > 20 && (
                    <div className="text-muted-foreground">
                      ...{t("common.andMore", { count: previewFiles.length - 20 })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleExport} disabled={!canExport} className="gap-2">
            <Download className="h-4 w-4" />
            {t("export.workspace.exportButton")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
