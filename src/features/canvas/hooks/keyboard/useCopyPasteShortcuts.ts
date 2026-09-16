import { useCallback, type MutableRefObject } from "react";
import { toast } from "sonner";
import type { ReactFlowInstance } from "@xyflow/react";
import {
  useDiagramStore,
  type Component,
  type Connection,
  type ClipboardEntry,
  type Diagram,
  type DiagramModel,
  type NodeLayout,
} from "@/features/diagram";
import {
  isModKeyPressed,
  keyMatchesLetter,
  getSelectedNodes,
  getCopyableIds,
  getPasteFlowPosition,
  getOffsetPositionOfNodes,
  KEY,
  type KeyHandler,
} from "./helpers";
import { duplicateSelection } from "../../utils/duplicateSelection";
import {
  readDrawioFromClipboard,
  readRasterImageBlobFromClipboard,
  readStructuraClipboard,
  readSvgFromClipboard,
  writeDrawioToClipboard,
} from "@/lib/clipboard";
import { parseDrawioXml } from "@/lib/export-service/import-drawio";
import { rasterBlobToSvgMarkup } from "@/features/canvas/utils/wrapRasterAsSvg";

interface UseCopyPasteShortcutsParams {
  diagram: Diagram | DiagramModel | null | undefined;
  selectedNodeId: string | null;
  reactFlowInstance: ReactFlowInstance;
  reactFlowWrapperRef: React.RefObject<HTMLDivElement | null>;
  copyToClipboard: (ids: string[]) => void;
  pasteFromClipboard: (
    position?: { x: number; y: number },
    options?: { preserveParentWhenMissing?: boolean },
  ) => string[];
  importDrawioResult: (
    components: Component[],
    connections: Connection[],
    layouts: NodeLayout[],
  ) => string[];
  hydrateClipboard: (entry: ClipboardEntry) => void;
  pasteSvgAsCanvasNode: (svgContent: string, position: { x: number; y: number }) => string | null;
  serviceCatalog: Record<string, { id: string; name: string }>;
  exportDrawioXml: (componentIds: string[]) => string;
  setSelectedNodeIds: (ids: Set<string>) => void;
  lastPointerScreenRef: MutableRefObject<{ x: number; y: number } | null>;
  translate: (key: string) => string;
}

export function useCopyPasteShortcuts({
  diagram,
  selectedNodeId,
  reactFlowInstance,
  reactFlowWrapperRef,
  copyToClipboard,
  pasteFromClipboard,
  importDrawioResult,
  hydrateClipboard,
  pasteSvgAsCanvasNode,
  serviceCatalog,
  exportDrawioXml,
  setSelectedNodeIds,
  lastPointerScreenRef,
  translate,
}: UseCopyPasteShortcutsParams): KeyHandler {
  return useCallback(
    async (event: KeyboardEvent): Promise<boolean> => {
      if (!diagram) return false;
      const mod = isModKeyPressed(event);
      if (!mod) return false;

      if (keyMatchesLetter(event, KEY.C)) {
        event.preventDefault();
        const nodes = getSelectedNodes(reactFlowInstance, selectedNodeId);
        const ids = getCopyableIds(diagram, nodes);
        if (ids.length > 0) {
          copyToClipboard(ids);
          try {
            const xml = exportDrawioXml(ids);
            // Embed the just-copied full-fidelity entry alongside the draw.io XML so
            // pasting into a different browser tab/window (a separate in-memory store,
            // where the rich clipboard below isn't shared) can still be lossless.
            const entry = useDiagramStore.getState().clipboard;
            void writeDrawioToClipboard(xml, entry ?? undefined);
          } catch {
            // drawio export is best-effort; internal clipboard copy already succeeded
          }
        }
        return true;
      }

      if (keyMatchesLetter(event, KEY.V)) {
        event.preventDefault();

        const pastePos = getPasteFlowPosition(
          reactFlowInstance,
          reactFlowWrapperRef,
          lastPointerScreenRef.current,
        );

        const svgMarkup = await readSvgFromClipboard();
        if (svgMarkup) {
          const newId = pasteSvgAsCanvasNode(svgMarkup, pastePos);
          if (newId) {
            reactFlowInstance.setNodes((nodes) =>
              nodes.map((n) => ({ ...n, selected: n.id === newId })),
            );
            setSelectedNodeIds(new Set([newId]));
          }
          return true;
        }

        const rasterBlob = await readRasterImageBlobFromClipboard();
        if (rasterBlob) {
          const wrapped = await rasterBlobToSvgMarkup(rasterBlob, rasterBlob.type);
          if (!wrapped) {
            toast.error(translate("icons.svgTooLarge"));
            return true;
          }
          const newId = pasteSvgAsCanvasNode(wrapped, pastePos);
          if (newId) {
            reactFlowInstance.setNodes((nodes) =>
              nodes.map((n) => ({ ...n, selected: n.id === newId })),
            );
            setSelectedNodeIds(new Set([newId]));
          }
          return true;
        }

        // A hidden marker embedded by our own writeDrawioToClipboard carries the
        // full-fidelity entry (styles, AWS type/icon, custom colors) alongside the
        // draw.io XML. It survives across browser tabs/windows via the OS clipboard,
        // unlike the in-memory Zustand clipboard below — so prefer it whenever
        // present, and only fall back to the lossy XML import for genuinely
        // external draw.io content (a real draw.io app, or an older Structura tab).
        const structuraEntry = await readStructuraClipboard();
        if (structuraEntry) {
          hydrateClipboard(structuraEntry);
        } else {
          const drawioXml = await readDrawioFromClipboard();
          if (drawioXml) {
            const pasteCenter = getPasteFlowPosition(
              reactFlowInstance,
              reactFlowWrapperRef,
              lastPointerScreenRef.current,
            );
            const result = parseDrawioXml(drawioXml, pasteCenter, serviceCatalog);
            if (result.components.length > 0 || result.connections.length > 0) {
              const newIds = importDrawioResult(
                result.components,
                result.connections,
                result.layouts,
              );
              if (newIds.length > 0) {
                reactFlowInstance.setNodes((nodes) =>
                  nodes.map((node) => ({ ...node, selected: newIds.includes(node.id) })),
                );
                setSelectedNodeIds(new Set(newIds));
              }
              return true;
            }
          }
        }

        const clipboardIds =
          useDiagramStore.getState().clipboard?.components.map((component) => component.id) ?? [];

        const offsetPos =
          diagram && clipboardIds.length > 0
            ? getOffsetPositionOfNodes(diagram, clipboardIds)
            : null;

        const elementPastePos = offsetPos ?? pastePos;
        const newIds = pasteFromClipboard(elementPastePos);
        if (newIds.length > 0) {
          reactFlowInstance.setNodes((nodes) =>
            nodes.map((node) => ({ ...node, selected: newIds.includes(node.id) })),
          );
          setSelectedNodeIds(new Set(newIds));
        }
        return true;
      }

      if (keyMatchesLetter(event, KEY.D)) {
        event.preventDefault();
        const selectedNodes = getSelectedNodes(reactFlowInstance, selectedNodeId);
        const newIds = duplicateSelection({
          diagram,
          nodes: selectedNodes,
          copyToClipboard,
          pasteFromClipboard,
        });
        if (newIds.length > 0) {
          reactFlowInstance.setNodes((nodes) =>
            nodes.map((node) => ({ ...node, selected: newIds.includes(node.id) })),
          );
          setSelectedNodeIds(new Set(newIds));
        }
        return true;
      }

      return false;
    },
    [
      diagram,
      selectedNodeId,
      reactFlowInstance,
      reactFlowWrapperRef,
      copyToClipboard,
      pasteFromClipboard,
      importDrawioResult,
      hydrateClipboard,
      pasteSvgAsCanvasNode,
      serviceCatalog,
      exportDrawioXml,
      setSelectedNodeIds,
      lastPointerScreenRef,
      translate,
    ],
  );
}
