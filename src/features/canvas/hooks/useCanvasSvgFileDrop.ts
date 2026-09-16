import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { ReactFlowInstance } from "@xyflow/react";
import type { Component, Connection, NodeLayout } from "@/features/diagram";
import { ELEMENT_PRESET_DRAG_MIME } from "@/features/element-presets";
import {
  fileToSvgMarkup,
  importSvgMarkupToCanvas,
  isImportableCanvasImageFile,
  svgNodeNameFromFile,
} from "../utils/importSvgToCanvas";

interface UseCanvasSvgFileDropParams {
  canEdit: boolean;
  reactFlowInstance: ReactFlowInstance;
  importDrawioResult: (
    components: Component[],
    connections: Connection[],
    layouts: NodeLayout[],
  ) => string[];
  setSelectedNodeIds: (ids: Set<string>) => void;
}

/**
 * Drop SVG / PNG / JPG onto the canvas → create `svg` nodes (rasters are
 * wrapped as base64 `<image>` inside an SVG root). Preset MIME drops are left
 * for the caller.
 */
export function useCanvasSvgFileDrop({
  canEdit,
  reactFlowInstance,
  importDrawioResult,
  setSelectedNodeIds,
}: UseCanvasSvgFileDropParams): {
  onDragOver: (event: React.DragEvent) => void;
  onDropFiles: (event: React.DragEvent) => Promise<boolean>;
} {
  const { t } = useTranslation();

  const onDragOver = useCallback(
    (event: React.DragEvent) => {
      if (!canEdit) return;
      const types = Array.from(event.dataTransfer.types);
      if (types.includes(ELEMENT_PRESET_DRAG_MIME) || types.includes("Files")) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }
    },
    [canEdit],
  );

  const onDropFiles = useCallback(
    async (event: React.DragEvent): Promise<boolean> => {
      if (!canEdit) return false;
      const files = Array.from(event.dataTransfer.files).filter(isImportableCanvasImageFile);
      if (files.length === 0) return false;

      event.preventDefault();
      event.stopPropagation();

      const origin = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newIds: string[] = [];
      for (let index = 0; index < files.length; index++) {
        const file = files[index]!;
        const markup = await fileToSvgMarkup(file);
        if (!markup) {
          toast.error(t("icons.invalidSvg"));
          continue;
        }
        const id = importSvgMarkupToCanvas({
          rawSvg: markup,
          position: { x: origin.x + index * 24, y: origin.y + index * 24 },
          name: svgNodeNameFromFile(file),
          importDrawioResult,
          translate: t,
        });
        if (id) newIds.push(id);
      }

      if (newIds.length > 0) {
        reactFlowInstance.setNodes((nodes) =>
          nodes.map((node) => ({ ...node, selected: newIds.includes(node.id) })),
        );
        setSelectedNodeIds(new Set(newIds));
      }
      return true;
    },
    [canEdit, importDrawioResult, reactFlowInstance, setSelectedNodeIds, t],
  );

  return { onDragOver, onDropFiles };
}
