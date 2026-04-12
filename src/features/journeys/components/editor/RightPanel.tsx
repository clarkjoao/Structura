import type {
  ChangeEventHandler,
  ClipboardEvent,
  KeyboardEvent,
  ReactNode,
} from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Play,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sanitizeSvg } from "@/features/canvas";
import { cn } from "@/lib/utils";
import { useJourneyActions } from "../../store/selectors/journeys.selectors";
import type { JourneyStep } from "../../types";
import { stepHasVisualMedia } from "../../utils/step-media.utils";

interface RightPanelProps {
  journeyId: string;
  step: JourneyStep | null;

  flowSection: ReactNode;
  isGlobalPlaying: boolean;
  onExpandVisual?: () => void;
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = () => {
      reject(reader.error);
    };
    reader.readAsDataURL(file);
  });
}

function isSvgFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".svg") || file.type === "image/svg+xml";
}

function isRasterImageFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    /\.(png|jpg|jpeg)$/i.test(name) ||
    file.type === "image/png" ||
    file.type === "image/jpeg"
  );
}

function clipboardTextLooksLikeSvg(text: string): boolean {
  const plain = text.trimStart().replace(/^\uFEFF/, "");
  const lower = plain.toLowerCase();
  if (lower.startsWith("<svg")) {
    return true;
  }
  return /^<\?xml/i.test(plain) && /<svg/i.test(plain);
}

export function RightPanel({
  journeyId,
  step,
  flowSection,
  isGlobalPlaying,
  onExpandVisual,
}: RightPanelProps) {
  const { t } = useTranslation();
  const { updateJourneyStep } = useJourneyActions();
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [visualOpen, setVisualOpen] = useState(true);
  const [flowOpen, setFlowOpen] = useState(true);
  const panelCollapsed = !visualOpen && !flowOpen;

  useEffect(() => {
    if (isGlobalPlaying) {
      setFlowOpen(false);
    }
  }, [isGlobalPlaying]);

  const persistMedia = useCallback(
    (mediaContent: NonNullable<JourneyStep["mediaContent"]>) => {
      if (!step) return;
      updateJourneyStep(journeyId, step.id, {
        mediaContent,
        svgContent: undefined,
      });
    },
    [journeyId, step, updateJourneyStep],
  );

  const processFile = useCallback(
    async (file: File) => {
      if (!step) return;

      if (isSvgFile(file)) {
        const text = await file.text();
        const cleaned = sanitizeSvg(text);
        if (!cleaned) {
          toast.error(t("icons.invalidSvg"));
          return;
        }
        persistMedia({ type: "svg", data: cleaned });
        return;
      }

      if (isRasterImageFile(file)) {
        try {
          const dataUrl = await readFileAsDataURL(file);
          persistMedia({ type: "image", data: dataUrl });
        } catch {
          toast.error(t("journeys.editor.mediaReadError"));
        }
        return;
      }

      toast.error(t("journeys.editor.invalidMediaFormat"));
    },
    [persistMedia, step, t],
  );

  const handleFileChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    if (isGlobalPlaying) {
      event.target.value = "";
      return;
    }
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    void processFile(file);
  };

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLDivElement>) => {
      if (!step || isGlobalPlaying) return;

      const files = event.clipboardData?.files;
      if (files && files.length > 0) {
        for (let index = 0; index < files.length; index += 1) {
          const file = files.item(index);
          if (!file) continue;
          if (file.type.startsWith("image/")) {
            event.preventDefault();
            void processFile(file);
            return;
          }
        }
      }

      const text = event.clipboardData?.getData("text/plain") ?? "";
      if (!clipboardTextLooksLikeSvg(text)) {
        return;
      }
      event.preventDefault();
      const cleaned = sanitizeSvg(text);
      if (!cleaned) {
        toast.error(t("icons.invalidSvg"));
        return;
      }
      persistMedia({ type: "svg", data: cleaned });
    },
    [isGlobalPlaying, persistMedia, processFile, step, t],
  );

  const handleDropzoneKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (isGlobalPlaying) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        fileInputRef.current?.click();
      }
    },
    [isGlobalPlaying],
  );

  const handleRemoveMedia = () => {
    if (!step) return;
    updateJourneyStep(journeyId, step.id, {
      svgContent: undefined,
      mediaContent: undefined,
    });
  };

  if (panelCollapsed) {
    return (
      <div className="flex w-10 shrink-0 flex-col items-center gap-2 border-l border-border bg-card py-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          aria-label={t("journeys.editor.expandVisualPanel")}
          onClick={() => setVisualOpen(true)}
        >
          <ImageIcon className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          aria-label={t("journeys.editor.expandFlowPanel")}
          onClick={() => setFlowOpen(true)}
        >
          <Play className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  const visualSectionClassName = cn(
    "flex min-h-0 flex-col",
    !visualOpen && "shrink-0",
    visualOpen && flowOpen && "flex-1",
    visualOpen && !flowOpen && "flex-1 max-h-none",
  );

  const flowSectionClassName = cn(
    "flex min-h-0 flex-col border-t border-border",
    !flowOpen && "shrink-0",
    flowOpen && "flex-1",
  );

  return (
    <div className="flex h-full min-h-0 w-[280px] shrink-0 flex-col overflow-hidden border-l border-border bg-card">
      <div className={visualSectionClassName}>
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3">
          <span className="text-sm font-semibold text-foreground">
            {t("journeys.editor.visualStateTitle")}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label={
              visualOpen
                ? t("journeys.editor.collapseVisualPanel")
                : t("journeys.editor.expandVisualPanel")
            }
            onClick={() => setVisualOpen((previous) => !previous)}
          >
            {visualOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
        {visualOpen ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {!step ? (
              <p className="text-center text-sm text-muted-foreground">
                {t("journeys.editor.selectStepForVisual")}
              </p>
            ) : stepHasVisualMedia(step) ? (
              <div className="grid gap-3">
                <button
                  type="button"
                  className={cn(
                    "group relative w-full overflow-hidden rounded-lg border border-border",
                    isGlobalPlaying
                      ? "transition-all hover:border-primary/50"
                      : "cursor-default",
                  )}
                  onClick={isGlobalPlaying ? onExpandVisual : undefined}
                  aria-label={
                    isGlobalPlaying
                      ? t("journeys.editor.expandVisual")
                      : undefined
                  }
                >
                  {step.mediaContent?.type === "svg" ? (
                    <div
                      className="w-full [&_svg]:h-auto [&_svg]:max-w-full"
                      dangerouslySetInnerHTML={{
                        __html: step.mediaContent.data,
                      }}
                    />
                  ) : step.mediaContent?.type === "image" ? (
                    <img
                      src={step.mediaContent.data}
                      alt={t("journeys.editor.mediaPreviewAlt")}
                      className="h-auto w-full"
                    />
                  ) : step.svgContent ? (
                    <div
                      className="w-full [&_svg]:h-auto [&_svg]:max-w-full"
                      dangerouslySetInnerHTML={{ __html: step.svgContent }}
                    />
                  ) : null}
                  {isGlobalPlaying ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/0 opacity-0 transition-all group-hover:bg-background/40 group-hover:opacity-100">
                      <span className="rounded-full bg-card px-3 py-1 text-xs font-medium text-foreground shadow">
                        {t("journeys.editor.expandVisual")}
                      </span>
                    </div>
                  ) : null}
                </button>
                {!isGlobalPlaying ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit gap-1"
                    onClick={handleRemoveMedia}
                  >
                    <X className="h-3.5 w-3.5" />
                    {t("journeys.editor.removeMedia")}
                  </Button>
                ) : null}
              </div>
            ) : isGlobalPlaying ? (
              <p className="text-center text-sm text-muted-foreground">
                {t("journeys.editor.noVisualForStep")}
              </p>
            ) : (
              <div
                tabIndex={0}
                onPaste={isGlobalPlaying ? undefined : handlePaste}
                onKeyDown={handleDropzoneKeyDown}
                className="flex cursor-default flex-col gap-2 rounded-lg border-2 border-dashed border-border p-6 outline-none transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                role="group"
                aria-label={t("journeys.editor.uploadMedia")}
              >
                <label
                  htmlFor={fileInputId}
                  className="flex cursor-pointer flex-col items-center gap-2"
                >
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <span className="text-center text-sm text-muted-foreground">
                    {t("journeys.editor.uploadMedia")}
                  </span>
                  <input
                    ref={fileInputRef}
                    id={fileInputId}
                    type="file"
                    accept=".svg,.png,.jpg,.jpeg"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
                <p className="text-center text-xs text-muted-foreground">
                  {t("journeys.editor.pasteMedia")}
                </p>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className={flowSectionClassName}>
        <div
          className={cn(
            "flex h-11 shrink-0 items-center justify-between px-3",
            flowOpen && "border-b border-border",
          )}
        >
          <span className="text-sm font-semibold text-foreground">
            {t("journeys.editor.flowSectionTitle")}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={isGlobalPlaying}
            aria-label={
              flowOpen
                ? t("journeys.editor.collapseFlowPanel")
                : t("journeys.editor.expandFlowPanel")
            }
            onClick={() => setFlowOpen((previous) => !previous)}
          >
            {flowOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
        {flowOpen ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {isGlobalPlaying ? (
              <p className="text-center text-xs text-muted-foreground">
                {t("journeys.editor.flowLockedDuringPlayback")}
              </p>
            ) : (
              flowSection
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
