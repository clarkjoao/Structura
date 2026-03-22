import * as React from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useIconActions, useIconLibrary } from "@/features/diagram";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { readFileAsText } from "@/features/canvas/utils/read-file-as-text";
import { sanitizeSvg } from "@/features/canvas/utils/svg.sanitizer";
import { generateIconId, normalizeSvgForStorage } from "@/features/canvas/utils/svg.utils";
import { IconPickerLibraryGrid } from "./IconPickerLibraryGrid";

export interface IconPickerModalProps {
  diagramId: string;
  onSelect: (iconId: string) => void;
  onClose: () => void;
  currentIconId?: string;
}

export function IconPickerModal({
  diagramId,
  onSelect,
  onClose,
  currentIconId,
}: IconPickerModalProps) {
  const { t } = useTranslation();
  const iconLibrary = useIconLibrary();
  const { addIcon } = useIconActions();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const filteredIcons = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return iconLibrary;
    return iconLibrary.filter((icon) => icon.name.toLowerCase().includes(query));
  }, [iconLibrary, searchQuery]);

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
          svgContent: normalizeSvgForStorage(cleaned),
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

  const isEmpty = filteredIcons.length === 0;

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

        <Input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder={t("icons.searchPlaceholder")}
          disabled={isUploading}
          aria-label={t("icons.searchPlaceholder")}
        />

        <ScrollArea className="min-h-[200px] flex-1 pr-3">
          {isEmpty ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("icons.emptyLibrary")}</p>
          ) : (
            <IconPickerLibraryGrid
              icons={filteredIcons}
              currentIconId={currentIconId}
              disabled={isUploading}
              onPick={onSelect}
            />
          )}
        </ScrollArea>

        <div className="space-y-2 border-t border-border pt-4">
          <p className="text-sm font-medium">{t("icons.addNew")}</p>
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
      </DialogContent>
    </Dialog>
  );
}
