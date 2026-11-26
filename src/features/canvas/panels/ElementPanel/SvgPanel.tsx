import { useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Download, Replace } from "lucide-react";
import type { ComponentPatch, SvgComponent } from "@/features/diagram";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { safeSvgMarkup } from "../../utils/svg.render";
import { normalizeSvgForStorage, svgHasArtwork } from "../../utils/svg.utils";
import { prepareImportedSvgMarkup } from "../../utils/importSvgToCanvas";
import { ElementScaffold, PanelSection } from "./shell";

interface SvgPanelProps {
  component: SvgComponent;
  onClose: () => void;
  updateComponent: (id: string, patch: ComponentPatch) => void;
  removeComponent: (id: string) => void;
  focusTitleTrigger?: number;
  onFocusElement?: (componentId: string) => void;
}

/** A file name from the element's name: "Logo Pix" → "logo-pix.svg". */
function fileNameFor(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "image"}.svg`;
}

/** The artwork's own size, from its viewBox or width/height; null when it states neither. */
function intrinsicSize(svg: string): { width: number; height: number } | null {
  const element = new DOMParser().parseFromString(svg, "image/svg+xml").querySelector("svg");
  if (!element) return null;
  const viewBox = element
    .getAttribute("viewBox")
    ?.trim()
    .split(/[\s,]+/);
  const width = Number(viewBox?.length === 4 ? viewBox[2] : element.getAttribute("width"));
  const height = Number(viewBox?.length === 4 ? viewBox[3] : element.getAttribute("height"));
  return width > 0 && height > 0 ? { width: Math.round(width), height: Math.round(height) } : null;
}

const ACTION_BUTTON =
  "flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors enabled:hover:bg-accent disabled:opacity-40";

/**
 * The artwork first: a preview on a transparency grid, its size, and the two things done to an
 * image — swap it for another file, or take it out as a file. The frame toggle follows.
 */
export default function SvgPanel({
  component,
  onClose,
  updateComponent,
  removeComponent,
  focusTitleTrigger = 0,
  onFocusElement,
}: SvgPanelProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const showBorder = component.showBorder !== false;
  const markup = useMemo(() => safeSvgMarkup(component.svgContent), [component.svgContent]);
  const hasArt = useMemo(() => svgHasArtwork(component.svgContent), [component.svgContent]);
  const size = useMemo(
    () => (hasArt ? intrinsicSize(component.svgContent) : null),
    [hasArt, component.svgContent],
  );

  const replaceFrom = async (file: File) => {
    const clean = prepareImportedSvgMarkup(await file.text(), t);
    if (clean) updateComponent(component.id, { svgContent: normalizeSvgForStorage(clean) });
  };

  const download = () => {
    const blob = new Blob([component.svgContent], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileNameFor(component.name);
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ElementScaffold
      component={component}
      onClose={onClose}
      updateComponent={updateComponent}
      removeComponent={removeComponent}
      onFocusElement={onFocusElement}
      focusTitleTrigger={focusTitleTrigger}
      namePlaceholder={t("svgNode.defaultName")}
      sizable
      minWidth={120}
      minHeight={120}
    >
      <PanelSection title={t("panelShell.sectionWhat")}>
        <figure className="space-y-1.5">
          <div
            data-testid="svg-preview"
            className="flex h-40 items-center justify-center overflow-hidden rounded-md border border-border p-3 [&>svg]:h-full [&>svg]:max-w-full [&>svg]:w-auto"
            style={{
              // A transparency grid, so the artwork's own background (or lack of one) shows.
              backgroundColor: "hsl(var(--background))",
              backgroundImage:
                "linear-gradient(45deg, hsl(var(--muted)) 25%, transparent 25%, transparent 75%, hsl(var(--muted)) 75%), linear-gradient(45deg, hsl(var(--muted)) 25%, transparent 25%, transparent 75%, hsl(var(--muted)) 75%)",
              backgroundSize: "16px 16px",
              backgroundPosition: "0 0, 8px 8px",
            }}
            {...(hasArt
              ? { dangerouslySetInnerHTML: { __html: markup } }
              : {
                  children: (
                    <span className="text-xs text-muted-foreground">{t("svgNode.emptyHint")}</span>
                  ),
                })}
          />
          {hasArt && size && (
            <figcaption className="text-[11px] text-muted-foreground">
              {t("svgNode.size", { width: size.width, height: size.height })}
            </figcaption>
          )}
        </figure>

        <div className="flex gap-2">
          <button
            type="button"
            className={ACTION_BUTTON}
            onClick={() => fileInputRef.current?.click()}
          >
            <Replace className="h-3.5 w-3.5" aria-hidden />
            {hasArt ? t("svgNode.replace") : t("svgNode.choose")}
          </button>
          <button type="button" className={ACTION_BUTTON} onClick={download} disabled={!hasArt}>
            <Download className="h-3.5 w-3.5" aria-hidden />
            {t("svgNode.download")}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".svg,image/svg+xml"
            className="hidden"
            data-testid="svg-replace-input"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void replaceFrom(file);
            }}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <Label htmlFor="svg-show-border" className="text-sm font-medium">
              {t("svgNode.showBorder")}
            </Label>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {t("svgNode.showBorderHint")}
            </p>
          </div>
          <Switch
            id="svg-show-border"
            checked={showBorder}
            onCheckedChange={(checked) => {
              updateComponent(component.id, { showBorder: checked });
            }}
          />
        </div>
      </PanelSection>
    </ElementScaffold>
  );
}
