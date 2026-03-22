import * as React from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useIconActions, useIconLibrary } from "@/features/diagram";
import { AWS_SERVICE_MAP } from "@/lib/catalogs/aws";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { readFileAsText } from "@/features/canvas/utils/read-file-as-text";
import { sanitizeSvg } from "@/features/canvas/utils/svg.sanitizer";
import { generateIconId, normalizeSvgForStorage } from "@/features/canvas/utils/svg.utils";
import { AwsIconPickerPanel } from "./AwsIconPickerPanel";
import { IconPickerLibraryGrid } from "./IconPickerLibraryGrid";
import { LucidePickerPanel } from "./LucidePickerPanel";

export type IconTab = "library" | "lucide" | "aws" | "upload";

export interface IconPickerModalProps {
  diagramId: string;
  onSelect: (iconId: string) => void;
  onClose: () => void;
  currentIconId?: string;
}

function displayNameFromLucideIconName(iconName: string): string {
  const withSpaces = iconName.replace(/-/g, " ");
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

function displayNameFromAwsIconName(iconName: string): string {
  for (const service of AWS_SERVICE_MAP.values()) {
    if (service.iconName === iconName) {
      return service.name;
    }
  }
  return iconName;
}

const TAB_BODY_SCROLL_STYLE: React.CSSProperties = { maxHeight: "420px" };

export function IconPickerModal({
  diagramId,
  onSelect,
  onClose,
  currentIconId,
}: IconPickerModalProps) {
  const { t } = useTranslation();
  const iconLibrary = useIconLibrary();
  const { addIcon } = useIconActions();
  const [activeTab, setActiveTab] = React.useState<IconTab>("library");
  const [librarySearchQuery, setLibrarySearchQuery] = React.useState("");
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const filteredIcons = React.useMemo(() => {
    const query = librarySearchQuery.trim().toLowerCase();
    if (!query) return iconLibrary;
    return iconLibrary.filter((icon) => icon.name.toLowerCase().includes(query));
  }, [iconLibrary, librarySearchQuery]);

  const handleOpenFilePicker = React.useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      setIsUploading(true);
      try {
        const text = await readFileAsText(file);
        const cleaned = sanitizeSvg(text);
        if (cleaned === null) {
          toast.error(t("icons.invalidSvg"));
          return;
        }
        const newId = generateIconId();
        const baseName = file.name.replace(/\.svg$/i, "").trim() || newId;
        addIcon(diagramId, {
          id: newId,
          name: baseName,
          source: {
            kind: "svg",
            svgContent: normalizeSvgForStorage(cleaned),
          },
          createdAt: Date.now(),
          usageCount: 0,
        });
        onSelect(newId);
      } catch {
        toast.error(t("icons.invalidSvg"));
      } finally {
        setIsUploading(false);
      }
    },
    [addIcon, diagramId, onSelect, t],
  );

  const handleLucideIconPick = React.useCallback(
    (iconName: string) => {
      const newId = generateIconId();
      addIcon(diagramId, {
        id: newId,
        name: displayNameFromLucideIconName(iconName),
        source: { kind: "lucide", iconName },
        createdAt: Date.now(),
        usageCount: 0,
      });
      onSelect(newId);
      setActiveTab("library");
    },
    [addIcon, diagramId, onSelect],
  );

  const handleAwsIconPick = React.useCallback(
    (awsReactIconName: string) => {
      const newId = generateIconId();
      addIcon(diagramId, {
        id: newId,
        name: displayNameFromAwsIconName(awsReactIconName),
        source: { kind: "aws", serviceName: awsReactIconName },
        createdAt: Date.now(),
        usageCount: 0,
      });
      onSelect(newId);
      setActiveTab("library");
    },
    [addIcon, diagramId, onSelect],
  );

  const isLibraryEmpty = filteredIcons.length === 0;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col gap-4">
        <DialogHeader>
          <DialogTitle>{t("icons.pickerTitle")}</DialogTitle>
          <DialogDescription className="sr-only">{t("icons.pickerTitle")}</DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as IconTab)}
          className="flex flex-col gap-2"
        >
          <TabsList className="grid w-full shrink-0 grid-cols-2 gap-1 sm:grid-cols-4">
            <TabsTrigger value="library">{t("icons.tabs.library")}</TabsTrigger>
            <TabsTrigger value="lucide">{t("icons.tabs.lucide")}</TabsTrigger>
            <TabsTrigger value="aws">{t("icons.tabs.aws")}</TabsTrigger>
            <TabsTrigger value="upload">{t("icons.tabs.upload")}</TabsTrigger>
          </TabsList>

          <div className="overflow-y-auto pr-1" style={TAB_BODY_SCROLL_STYLE}>
            {activeTab === "library" ? (
              <div className="flex flex-col gap-3 pb-1">
                <Input
                  type="search"
                  value={librarySearchQuery}
                  onChange={(event) => setLibrarySearchQuery(event.target.value)}
                  placeholder={t("icons.searchPlaceholder")}
                  disabled={isUploading}
                  aria-label={t("icons.searchPlaceholder")}
                />
                {isLibraryEmpty ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">{t("icons.emptyLibrary")}</p>
                ) : (
                  <IconPickerLibraryGrid
                    icons={filteredIcons}
                    currentIconId={currentIconId}
                    disabled={isUploading}
                    onPick={onSelect}
                  />
                )}
              </div>
            ) : null}

            {activeTab === "lucide" ? (
              <div className="pb-1">
                <LucidePickerPanel onSelect={handleLucideIconPick} />
              </div>
            ) : null}

            {activeTab === "aws" ? (
              <div className="pb-1">
                <AwsIconPickerPanel onSelect={handleAwsIconPick} />
              </div>
            ) : null}

            {activeTab === "upload" ? (
              <div className="flex flex-col gap-3 pb-1">
                <p className="text-sm text-muted-foreground">{t("icons.addNew")}</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".svg"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={isUploading}
                  onClick={handleOpenFilePicker}
                  className="w-full sm:w-auto"
                >
                  {isUploading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : null}
                  <span>{t("icons.uploadButton")}</span>
                </Button>
              </div>
            ) : null}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
