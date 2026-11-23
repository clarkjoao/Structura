import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Check,
  Copy,
  Download,
  FileCode2,
  FileImage,
  FileJson,
  FileType,
  Frame,
  Link,
  Share2,
} from "lucide-react";
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
import { IncludeTextsSwitch } from "@/features/canvas/text/IncludeTextsSwitch";
import { usePluginIoContributions } from "@/features/plugins/use-plugin-contributions";
import { resolveLocalizedText } from "@/features/plugins/localized-text";
import type { DiagramExportFormat } from "@/lib/export-service";
import type { CopiedClipboardKind, ExportBuildResult } from "./types";

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasFlows: boolean;
  onExport: (
    formats: DiagramExportFormat[],
    pluginExporterIds: string[],
    framing?: "viewport" | "full",
  ) => Promise<ExportBuildResult>;
  onCopyDrawio: () => void;
  onCopyJson: () => void;
  copiedClipboardKind: CopiedClipboardKind | null;
}

type FormatBadge = "data" | "image";

interface FormatCard<T extends DiagramExportFormat | "drawio" | "json"> {
  key: string;
  format: T;
  icon: typeof FileJson;
  badge: FormatBadge;
  title: string;
  description: string;
  fileType: string;
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
  const [framing, setFraming] = useState<"viewport" | "full">("full");
  const [selectedPluginExporters, setSelectedPluginExporters] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);

  const hasImageFormat = selectedFormats.has("svg") || selectedFormats.has("png");
  const imageFraming = hasImageFormat ? framing : "full";

  useEffect(() => {
    if (!open) return;
    setSelectedFormats(new Set(["json", "drawio"]));
    setSelectedPluginExporters(new Set());
    setFraming("full");
    setActiveTab("download");
    setIsExporting(false);
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

  const handleExport = async () => {
    const formats = Array.from(selectedFormats) as DiagramExportFormat[];
    const pluginIds = Array.from(selectedPluginExporters);
    if (formats.length === 0 && pluginIds.length === 0) return;
    setIsExporting(true);
    try {
      const result = await onExport(formats, pluginIds, imageFraming);
      if (result.files.length > 0) {
        onOpenChange(false);
      } else {
        setIsExporting(false);
      }
    } catch {
      setIsExporting(false);
    }
  };

  const formatOptions: FormatCard<DiagramExportFormat>[] = [
    {
      key: "json",
      format: "json",
      icon: FileJson,
      badge: "data",
      title: t("export.options.json.title"),
      description: t("export.options.json.description"),
      fileType: "JSON",
    },
    {
      key: "drawio",
      format: "drawio",
      icon: FileCode2,
      badge: "data",
      title: t("export.options.drawio.title"),
      description: t("export.options.drawio.description"),
      fileType: "Draw.io",
    },
    ...(hasFlows
      ? ([
          {
            key: "mermaid",
            format: "mermaid" as const,
            icon: FileType,
            badge: "data",
            title: t("export.options.mermaid.title"),
            description: t("export.options.mermaid.description"),
            fileType: "MD",
          },
        ] satisfies FormatCard<DiagramExportFormat>[])
      : []),
    {
      key: "svg",
      format: "svg",
      icon: FileType,
      badge: "image",
      title: t("export.options.svg.title"),
      description: t("export.options.svg.description"),
      fileType: "SVG",
    },
    {
      key: "png",
      format: "png",
      icon: FileImage,
      badge: "image",
      title: t("export.options.png.title"),
      description: t("export.options.png.description"),
      fileType: "PNG",
    },
  ];

  const dataFormats = formatOptions.filter((f) => f.badge === "data");
  const imageFormats = formatOptions.filter((f) => f.badge === "image");

  const totalSelected = selectedFormats.size + selectedPluginExporters.size;

  const selectedLabels = [
    ...Array.from(selectedFormats).map((f) => t(`export.options.${f}.title`)),
    ...Array.from(selectedPluginExporters).map((id) => {
      const exporter = pluginExporters.find((e) => e.id === id);
      return exporter ? resolveLocalizedText(exporter.label, i18n.language) : id;
    }),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-base">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Share2 className="h-4 w-4" />
            </div>
            {t("export.title")}
          </DialogTitle>
          <DialogDescription className="text-xs">{t("export.description")}</DialogDescription>
        </DialogHeader>

        <IncludeTextsSwitch />

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="download" className="gap-1.5 text-xs">
              <Download className="h-3.5 w-3.5" />
              {t("export.tabs.download")}
            </TabsTrigger>
            <TabsTrigger value="copy" className="gap-1.5 text-xs">
              <Link className="h-3.5 w-3.5" />
              {t("export.tabs.copy")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="download" className="mt-4 space-y-4">
            {/* Data formats */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("export.groups.data")}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {dataFormats.map(({ key, format, icon: Icon, title, fileType }) => {
                  const isSelected = selectedFormats.has(format);
                  return (
                    <button
                      key={key}
                      type="button"
                      data-testid={`export-format-${format}`}
                      onClick={() => toggleFormat(format)}
                      className={cn(
                        "group relative flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 p-3 text-center transition-all",
                        isSelected
                          ? "border-primary bg-primary/[0.04] shadow-sm"
                          : "border-border hover:border-primary/40 hover:bg-muted/40",
                      )}
                    >
                      {isSelected && (
                        <div className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                          <Check className="h-3 w-3" />
                        </div>
                      )}
                      <div
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground group-hover:text-foreground",
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{title}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{fileType}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Image formats */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("export.groups.image")}
              </p>

              {/* Framing toggle */}
              <div className="flex rounded-lg border bg-muted/50 p-0.5">
                {(["viewport", "full"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    data-testid={`export-framing-${f}`}
                    onClick={() => setFraming(f)}
                    className={cn(
                      "relative flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                      framing === f
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {framing === f && (
                      <div className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-primary" />
                    )}
                    <Frame className="h-3 w-3" />
                    {t(`export.options.${f}`)}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {imageFormats.map(({ key, format, icon: Icon, title, fileType }) => {
                  const isSelected = selectedFormats.has(format);
                  return (
                    <button
                      key={key}
                      type="button"
                      data-testid={`export-format-${format}`}
                      onClick={() => toggleFormat(format)}
                      className={cn(
                        "group relative flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 p-3 text-center transition-all",
                        isSelected
                          ? "border-primary bg-primary/[0.04] shadow-sm"
                          : "border-border hover:border-primary/40 hover:bg-muted/40",
                      )}
                    >
                      {isSelected && (
                        <div className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                          <Check className="h-3 w-3" />
                        </div>
                      )}
                      <div
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground group-hover:text-foreground",
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{title}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{fileType}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Plugins */}
            {pluginExporters.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("export.plugins")}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {pluginExporters.map((exporter) => {
                    const isSelected = selectedPluginExporters.has(exporter.id);
                    return (
                      <button
                        key={exporter.id}
                        type="button"
                        onClick={() => togglePluginExporter(exporter.id)}
                        className={cn(
                          "group flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 p-2.5 text-center transition-all",
                          isSelected
                            ? "border-primary bg-primary/[0.04] shadow-sm"
                            : "border-border hover:border-primary/40 hover:bg-muted/40",
                        )}
                      >
                        {isSelected && (
                          <div className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                            <Check className="h-3 w-3" />
                          </div>
                        )}
                        <div
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          <FileCode2 className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-[11px] font-medium leading-tight break-words">
                            {resolveLocalizedText(exporter.label, i18n.language)}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-mono leading-tight">
                            .{exporter.extension}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="copy" className="mt-4 space-y-3">
            <p className="text-xs text-muted-foreground">{t("export.copyHint")}</p>

            <button
              type="button"
              onClick={onCopyJson}
              className={cn(
                "flex w-full items-center gap-3.5 rounded-xl border-2 p-4 text-left transition-all hover:border-primary/40 hover:bg-muted/40",
                copiedClipboardKind === "json" && "border-green-500 bg-green-500/[0.04]",
              )}
            >
              <div
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors",
                  copiedClipboardKind === "json"
                    ? "bg-green-500 text-white"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {copiedClipboardKind === "json" ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <FileJson className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{t("export.copyJson")}</p>
                <p className="text-xs text-muted-foreground">{t("export.copyJsonHint")}</p>
              </div>
              <Copy className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>

            <button
              type="button"
              onClick={onCopyDrawio}
              className={cn(
                "flex w-full items-center gap-3.5 rounded-xl border-2 p-4 text-left transition-all hover:border-primary/40 hover:bg-muted/40",
                copiedClipboardKind === "drawio" && "border-green-500 bg-green-500/[0.04]",
              )}
            >
              <div
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors",
                  copiedClipboardKind === "drawio"
                    ? "bg-green-500 text-white"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {copiedClipboardKind === "drawio" ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <FileImage className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{t("export.copyDrawio")}</p>
                <p className="text-xs text-muted-foreground">{t("export.copyDrawioHint")}</p>
              </div>
              <Copy className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {activeTab === "download" && (
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                {totalSelected > 0 ? (
                  <>
                    {t("export.summary.formats", { count: totalSelected })}:{" "}
                    <span className="font-medium text-foreground">{selectedLabels.join(", ")}</span>
                  </>
                ) : (
                  t("export.summary.none")
                )}
              </span>
              {hasImageFormat && (
                <span className="flex items-center gap-1">
                  <Frame className="h-3 w-3" />
                  {t(`export.options.${imageFraming}`)}
                </span>
              )}
            </div>
          )}
          <div className="flex w-full gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isExporting}
              className="flex-1"
            >
              {t("common.cancel")}
            </Button>
            {activeTab === "download" && (
              <Button
                onClick={handleExport}
                disabled={totalSelected === 0 || isExporting}
                className="flex-1 gap-2"
              >
                <Download className="h-4 w-4" />
                {isExporting
                  ? t("export.workspace.exporting")
                  : totalSelected > 1
                    ? t("export.downloadMultiple", { count: totalSelected })
                    : t("export.download")}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
