import { useEffect, type MutableRefObject, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { ReactFlowInstance } from "@xyflow/react";
import type { Component, Connection, NodeLayout } from "@/features/diagram";
import { extractSvgMarkup } from "@/lib/clipboard";
import { getPasteFlowPosition, isInputFocused } from "./keyboard/helpers";
import {
  importImageFilesToCanvas,
  importSvgMarkupToCanvas,
  isImportableCanvasImageFile,
} from "../utils/importSvgToCanvas";
import { rasterBlobToSvgMarkup } from "../utils/wrapRasterAsSvg";

interface UseCanvasMediaPasteParams {
  enabled: boolean;
  /** Set true when paste event consumed media so keydown Ctrl+V skips re-import. */
  mediaPasteConsumedRef: MutableRefObject<boolean>;
  reactFlowInstance: ReactFlowInstance;
  reactFlowWrapperRef: RefObject<HTMLDivElement | null>;
  lastPointerScreenRef: MutableRefObject<{ x: number; y: number } | null>;
  importDrawioResult: (
    components: Component[],
    connections: Connection[],
    layouts: NodeLayout[],
  ) => string[];
  setSelectedNodeIds: (ids: Set<string>) => void;
}

function collectClipboardImageFiles(data: DataTransfer | null): File[] {
  if (!data) return [];
  const fromFiles = Array.from(data.files).filter(isImportableCanvasImageFile);
  if (fromFiles.length > 0) return fromFiles;

  const fromItems: File[] = [];
  for (const item of Array.from(data.items ?? [])) {
    if (item.kind !== "file") continue;
    const file = item.getAsFile();
    if (file && isImportableCanvasImageFile(file)) {
      fromItems.push(file);
    }
  }
  return fromItems;
}

/**
 * Native `paste` capture for Finder copy→paste of .svg/.png/.jpg and for
 * screenshot image items / plain-text SVG. Sets `mediaPasteConsumedRef` so the
 * keydown Ctrl+V path does not import the same payload twice.
 */
export function useCanvasMediaPaste({
  enabled,
  mediaPasteConsumedRef,
  reactFlowInstance,
  reactFlowWrapperRef,
  lastPointerScreenRef,
  importDrawioResult,
  setSelectedNodeIds,
}: UseCanvasMediaPasteParams): void {
  const { t } = useTranslation();

  useEffect(() => {
    if (!enabled) return;

    const selectIds = (newIds: string[]) => {
      if (newIds.length === 0) return;
      reactFlowInstance.setNodes((nodes) =>
        nodes.map((node) => ({ ...node, selected: newIds.includes(node.id) })),
      );
      setSelectedNodeIds(new Set(newIds));
    };

    const onPaste = (event: ClipboardEvent) => {
      if (isInputFocused(event.target)) return;

      const pastePos = getPasteFlowPosition(
        reactFlowInstance,
        reactFlowWrapperRef,
        lastPointerScreenRef.current,
      );

      const files = collectClipboardImageFiles(event.clipboardData);
      if (files.length > 0) {
        event.preventDefault();
        event.stopPropagation();
        mediaPasteConsumedRef.current = true;
        void importImageFilesToCanvas({
          files,
          origin: pastePos,
          importDrawioResult,
          translate: t,
        }).then(selectIds);
        return;
      }

      for (const item of Array.from(event.clipboardData?.items ?? [])) {
        if (item.kind !== "file") continue;
        if (item.type !== "image/png" && item.type !== "image/jpeg") continue;
        const blob = item.getAsFile();
        if (!blob) continue;
        event.preventDefault();
        event.stopPropagation();
        mediaPasteConsumedRef.current = true;
        void (async () => {
          const wrapped = await rasterBlobToSvgMarkup(blob, blob.type);
          if (!wrapped) {
            toast.error(t("icons.svgTooLarge"));
            return;
          }
          const newId = importSvgMarkupToCanvas({
            rawSvg: wrapped,
            position: pastePos,
            showBorder: false,
            importDrawioResult,
            translate: t,
          });
          if (newId) selectIds([newId]);
        })();
        return;
      }

      const plain = event.clipboardData?.getData("text/plain") ?? "";
      const svgMarkup = extractSvgMarkup(plain);
      if (svgMarkup) {
        event.preventDefault();
        event.stopPropagation();
        mediaPasteConsumedRef.current = true;
        const newId = importSvgMarkupToCanvas({
          rawSvg: svgMarkup,
          position: pastePos,
          showBorder: false,
          importDrawioResult,
          translate: t,
        });
        if (newId) selectIds([newId]);
      }
    };

    document.addEventListener("paste", onPaste, true);
    return () => document.removeEventListener("paste", onPaste, true);
  }, [
    enabled,
    importDrawioResult,
    lastPointerScreenRef,
    mediaPasteConsumedRef,
    reactFlowInstance,
    reactFlowWrapperRef,
    setSelectedNodeIds,
    t,
  ]);
}
