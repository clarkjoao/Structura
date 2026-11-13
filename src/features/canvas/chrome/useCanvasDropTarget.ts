import type { DragEvent } from "react";
import { useReactFlow } from "@xyflow/react";
import { ELEMENT_PRESET_DRAG_MIME, useElementPresetLibrary } from "@/features/element-presets";
import { useCatalogDrop } from "../catalog/useCatalogDrop";
import { useCanvasSvgFileDrop } from "../hooks/useCanvasSvgFileDrop";
import type { useDiagramActions } from "@/features/diagram";

interface UseCanvasDropTargetParams {
  canEditCanvas: boolean;
  importDrawioResult: ReturnType<typeof useDiagramActions>["importDrawioResult"];
  setSelectedNodeIds: (ids: Set<string>) => void;
  /** Selects the node a catalog drop inserted. */
  selectInsertedNode: (nodeId: string) => void;
}

/**
 * What can be dropped on the canvas, in this order: a catalog entry, an
 * image file, a saved preset.
 */
export function useCanvasDropTarget({
  canEditCanvas,
  importDrawioResult,
  setSelectedNodeIds,
  selectInsertedNode,
}: UseCanvasDropTargetParams) {
  const reactFlowInstance = useReactFlow();
  const { instantiatePreset } = useElementPresetLibrary();
  const { onDragOver: onSvgDragOver, onDropFiles: onSvgDropFiles } = useCanvasSvgFileDrop({
    canEdit: canEditCanvas,
    reactFlowInstance,
    importDrawioResult,
    setSelectedNodeIds,
  });
  const catalogDrop = useCatalogDrop(canEditCanvas, selectInsertedNode);

  const onDragOver = (event: DragEvent) => {
    onSvgDragOver(event);
    if (catalogDrop.onDragOver(event)) return;
    if (!canEditCanvas) return;
    if (event.dataTransfer.types.includes(ELEMENT_PRESET_DRAG_MIME)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    }
  };

  const onDrop = (event: DragEvent) => {
    // Synchronously: the drag data is only readable while the drop is dispatched.
    if (catalogDrop.onDrop(event)) return;
    void (async () => {
      if (await onSvgDropFiles(event)) return;
      if (!canEditCanvas) return;
      const presetId = event.dataTransfer.getData(ELEMENT_PRESET_DRAG_MIME);
      if (!presetId) return;
      event.preventDefault();
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      instantiatePreset({ presetId, position });
    })();
  };

  return { onDragOver, onDrop };
}
