import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, FileJson, FileImage, Link, QrCode, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { usePluginIoContributions } from "@/features/plugins/use-plugin-contributions";
import { resolveLocalizedText } from "@/features/plugins/localized-text";
import type { DiagramExportFormat } from "@/lib/export-service";
import type { CopiedClipboardKind } from "./types";

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasFlows: boolean;
  onExport: (formats: DiagramExportFormat[], pluginExporterIds: string[]) => void;
  onCopyDrawio: () => void;
  onCopyJson: () => void;
  copiedClipboardKind: CopiedClipboardKind | null;
}

export function ExportModal({
  open,
  onOpenChange,
  hasFlows,
  onExport,
  onCopyDrawio,
  onCopyJson,
  copiedClipboardKind,
}: ExportModalProps) {
  const { t, i18n } = useTranslation();
  const { exporters: pluginExporters } = usePluginIoContributions();
  const [activeTab, setActiveTab] = useState<"download" | "copy">("download");
  const [selectedFormats, setSelectedFormats] = useState<Set<DiagramExportFormat>>(
    new Set(["json", "drawio"]),
  );
  const [selectedPluginExporters, setSelectedPluginExporters] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setSelectedFormats(new Set(["json", "drawio"]));
    setSelectedPluginExporters(new Set());
    setActiveTab("download");
  }, [open]);

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

  const togglePluginExporter = (exporterId: string) => {
    setSelectedPluginExporters((prev) => {
      const next = new Set(prev);
      if (next.has(exporterId)) {
        next.delete(exporterId);
      } else {
        next.add(exporterId);
      }
      return next;
    });
  };

  const handleExport = () => {
    const formats = Array.from(selectedFormats) as DiagramExportFormat[];
    const pluginIds = Array.from(selectedPluginExporters);
    if (formats.length === 0 && pluginIds.length === 0) return;
    onExport(formats, pluginIds);
    onOpenChange(false);
  };

  const formatOptions: Array<{
    format: DiagramExportFormat;
    icon: typeof FileJson;
    title: string;
    description: string;
    disabled?: boolean;
    badge?: string;
  }> = [
    {
      format: "json",
      icon: FileJson,
      title: t("export.options.json.title"),
      description: t("export.options.json.description"),
      badge: t("export.options.recommended"),
    },
    {
      format: "drawio",
      icon: FileImage,
      title: t("export.options.drawio.title"),
      description: t("export.options.drawio.description"),
    },
    ...(hasFlows
      ? [
          {
            format: "mermaid" as const,
            icon: FileImage,
            title: t("export.options.mermaid.title"),
            description: t("export.options.mermaid.description"),
          },
        ]
      : []),
  ];

  const totalSelected = selectedFormats.size + selectedPluginExporters.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            {t("export.title")}
          </DialogTitle>
          <DialogDescription>{t("export.description")}</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="download" className="gap-2">
              <Download className="h-4 w-4" />
              {t("export.tabs.download")}
            </TabsTrigger>
            <TabsTrigger value="copy" className="gap-2">
              <Link className="h-4 w-4" />
              {t("export.tabs.copy")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="download" className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">{t("export.downloadHint")}</p>

            {formatOptions.map(({ format, icon: Icon, title, description, disabled, badge }) => (
              <button
                key={format}
                type="button"
                onClick={() => !disabled && toggleFormat(format)}
                disabled={disabled}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all",
                  selectedFormats.has(format)
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:border-primary/50 hover:bg-muted/50",
                  disabled && "cursor-not-allowed opacity-50",
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
                    {badge && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        {badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
              </button>
            ))}

            {pluginExporters.length > 0 && (
              <>
                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      {t("export.plugins")}
                    </span>
                  </div>
                </div>

                {pluginExporters.map((exporter) => (
                  <button
                    key={exporter.id}
                    type="button"
                    onClick={() => togglePluginExporter(exporter.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all",
                      selectedPluginExporters.has(exporter.id)
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-primary/50 hover:bg-muted/50",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-lg",
                        selectedPluginExporters.has(exporter.id)
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted",
                      )}
                    >
                      <FileJson className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {resolveLocalizedText(exporter.label, i18n.language)}
                      </p>
                      <p className="text-xs text-muted-foreground">.{exporter.extension}</p>
                    </div>
                  </button>
                ))}
              </>
            )}
          </TabsContent>

          <TabsContent value="copy" className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">{t("export.copyHint")}</p>

            <button
              type="button"
              onClick={onCopyJson}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all hover:border-primary/50 hover:bg-muted/50",
                copiedClipboardKind === "json" && "border-green-500 bg-green-500/5",
              )}
            >
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg",
                  copiedClipboardKind === "json" ? "bg-green-500 text-white" : "bg-muted",
                )}
              >
                {copiedClipboardKind === "json" ? "✓" : <FileJson className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{t("export.copyJson")}</p>
                <p className="text-xs text-muted-foreground">{t("export.copyJsonHint")}</p>
              </div>
            </button>

            <button
              type="button"
              onClick={onCopyDrawio}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all hover:border-primary/50 hover:bg-muted/50",
                copiedClipboardKind === "drawio" && "border-green-500 bg-green-500/5",
              )}
            >
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg",
                  copiedClipboardKind === "drawio" ? "bg-green-500 text-white" : "bg-muted",
                )}
              >
                {copiedClipboardKind === "drawio" ? "✓" : <FileImage className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{t("export.copyDrawio")}</p>
                <p className="text-xs text-muted-foreground">{t("export.copyDrawioHint")}</p>
              </div>
            </button>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          {activeTab === "download" && (
            <Button onClick={handleExport} disabled={totalSelected === 0} className="gap-2">
              <Download className="h-4 w-4" />
              {totalSelected > 1
                ? t("export.downloadMultiple", { count: totalSelected })
                : t("export.download")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
