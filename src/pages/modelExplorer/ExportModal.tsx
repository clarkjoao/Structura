import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Clipboard, Code2, Download, FileCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DiagramExportFormat } from "@/lib/export-service";
import { cn } from "@/lib/utils";
import { keyIsEnterOrSpace } from "@/lib/keyboard-utils";
import type { CopiedClipboardKind } from "./types";

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasFlows: boolean;
  onExport: (formats: DiagramExportFormat[]) => void;
  onCopyDrawio: () => void;
  onCopyJson: () => void;
  onCopyStructurizr: () => void;
  onEmbedRequest: () => void;
  copiedClipboardKind: CopiedClipboardKind | null;
}

const DEFAULT_FORMATS: DiagramExportFormat[] = ["json", "drawio"];
const FORMAT_ORDER: DiagramExportFormat[] = ["json", "drawio", "structurizr", "mermaid"];

export function ExportModal({
  open,
  onOpenChange,
  hasFlows,
  onExport,
  onCopyDrawio,
  onCopyJson,
  onCopyStructurizr,
  onEmbedRequest,
  copiedClipboardKind,
}: ExportModalProps) {
  const { t } = useTranslation();
  const [selectedFormats, setSelectedFormats] =
    useState<DiagramExportFormat[]>(DEFAULT_FORMATS);

  useEffect(() => {
    if (!open) return;
    setSelectedFormats(DEFAULT_FORMATS);
  }, [open]);

  const options = useMemo(
    () =>
      [
        {
          format: "json" as const,
          title: t("export.modal.options.json.title"),
          description: t("export.modal.options.json.description"),
          disabled: false,
        },
        {
          format: "drawio" as const,
          title: t("export.modal.options.drawio.title"),
          description: t("export.modal.options.drawio.description"),
          disabled: false,
        },
        {
          format: "structurizr" as const,
          title: t("export.modal.options.structurizr.title"),
          description: t("export.modal.options.structurizr.description"),
          disabled: false,
        },
        {
          format: "mermaid" as const,
          title: t("export.modal.options.mermaid.title"),
          description: hasFlows
            ? t("export.modal.options.mermaid.description")
            : t("export.modal.options.mermaid.disabledDescription"),
          disabled: !hasFlows,
        },
      ] satisfies Array<{
        format: DiagramExportFormat;
        title: string;
        description: string;
        disabled: boolean;
      }>,
    [hasFlows, t],
  );

  const clipboardRows = useMemo(
    () =>
      [
        {
          kind: "drawio" as const,
          label: t("flows.copyDrawio"),
          hint: t("export.hub.copyDrawioHint"),
          onClick: onCopyDrawio,
          icon: FileCode,
        },
        {
          kind: "json" as const,
          label: t("export.copyAsJson"),
          hint: t("export.hub.copyJsonHint"),
          onClick: onCopyJson,
          icon: Clipboard,
        },
        {
          kind: "structurizr" as const,
          label: t("export.copyAsStructurizr"),
          hint: t("export.hub.copyStructurizrHint"),
          onClick: onCopyStructurizr,
          icon: Clipboard,
        },
      ] as const,
    [onCopyDrawio, onCopyJson, onCopyStructurizr, t],
  );

  const selectedCount = selectedFormats.length;

  const toggleFormat = (format: DiagramExportFormat, checked: boolean) => {
    setSelectedFormats((current) => {
      if (checked) {
        if (current.includes(format)) {
          return current;
        }
        return [...current, format].sort(
          (left, right) => FORMAT_ORDER.indexOf(left) - FORMAT_ORDER.indexOf(right),
        );
      }
      return current.filter((value) => value !== format);
    });
  };

  const handleExport = () => {
    if (selectedFormats.length === 0) {
      return;
    }
    onExport(selectedFormats);
    onOpenChange(false);
  };

  const handleEmbedClick = () => {
    onOpenChange(false);
    onEmbedRequest();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[min(90vh,720px)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("export.hub.title")}</DialogTitle>
          <DialogDescription>{t("export.hub.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("export.hub.copySection")}
          </p>
          <div className="flex flex-col gap-2">
            {clipboardRows.map((row) => {
              const Icon = row.icon;
              const showCheck = copiedClipboardKind === row.kind;
              return (
                <button
                  key={row.kind}
                  type="button"
                  onClick={row.onClick}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-left transition-colors",
                    "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{row.label}</p>
                    <p className="text-xs text-muted-foreground">{row.hint}</p>
                  </div>
                  {showCheck ? (
                    <Check className="h-4 w-4 shrink-0 text-green-500" aria-hidden />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <Separator className="my-1" />

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("export.hub.downloadSection")}
          </p>
          <div className="flex flex-col gap-3">
            {options.map((option) => {
              const checked = selectedFormats.includes(option.format);
              const checkboxId = `export-format-${option.format}`;

              return (
                <div
                  key={option.format}
                  role="button"
                  tabIndex={option.disabled ? -1 : 0}
                  onClick={() => {
                    if (option.disabled) return;
                    toggleFormat(option.format, !checked);
                  }}
                  onKeyDown={(event) => {
                    if (option.disabled) return;
                    if (!keyIsEnterOrSpace(event)) return;
                    event.preventDefault();
                    toggleFormat(option.format, !checked);
                  }}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 transition-colors",
                    option.disabled
                      ? "border-border/60 bg-muted/30 opacity-70"
                      : "cursor-pointer border-border hover:bg-muted/40",
                  )}
                >
                  <Checkbox
                    id={checkboxId}
                    checked={checked}
                    disabled={option.disabled}
                    onCheckedChange={(value) => toggleFormat(option.format, value === true)}
                    onClick={(event) => event.stopPropagation()}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <Label htmlFor={checkboxId} className="cursor-pointer text-sm">
                      {option.title}
                    </Label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {option.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Separator className="my-1" />

        <button
          type="button"
          onClick={handleEmbedClick}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg border border-dashed border-border px-3 py-2.5 text-left transition-colors",
            "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <Code2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{t("export.embed.menuItem")}</p>
            <p className="text-xs text-muted-foreground">{t("export.hub.embedHint")}</p>
          </div>
        </button>

        <DialogFooter className="items-center sm:justify-between">
          <p className="mr-auto text-xs text-muted-foreground">
            {selectedCount > 1
              ? t("export.modal.zipHint")
              : t("export.modal.singleHint")}
          </p>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleExport}
              disabled={selectedCount === 0}
              className="gap-1.5"
            >
              <Download className="h-4 w-4" />
              {t("export.modal.confirm")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
