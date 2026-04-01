import { useCallback } from "react";
import type { ReactFlowInstance } from "@xyflow/react";
import {
  isPanelComponent,
  resolveCanvasSnapshot,
  useDiagramStore,
  type Component,
  type Connection,
  type Diagram,
  type NodeLayout,
} from "@/features/diagram";
import {
  isModKeyPressed,
  getSelectedNodes,
  getCopyableIds,
  getPasteCenter,
  getCenterOfNodes,
  getOffsetPositionOfNodes,
  type KeyHandler,
} from "./helpers";
import {
  readDrawioFromClipboard,
  readSvgFromClipboard,
  writeDrawioToClipboard,
} from "@/lib/clipboard-utils";
import { parseDrawioXml } from "@/lib/export-service/import-drawio";
import { generateIconId, normalizeSvgForStorage } from "@/features/canvas/utils/svg.utils";

interface UseCopyPasteShortcutsParams {
  diagram: Diagram | null | undefined;
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
  pasteSvgAsCanvasNode: (svgContent: string, position: { x: number; y: number }) => string | null;
  /** Validates size, then sanitizes SVG; returns markup safe for storage or null (toasts on failure). */
  importSvgForIconLibrary: (svgContent: string) => string | null;
  serviceRegistry: Record<string, { id: string; name: string }>;
  exportDrawioXml: (componentIds: string[]) => string;
  setSelectedNodeIds: (ids: Set<string>) => void;
  pastedSvgDefaultName: string;
}

/**
 * Cmd+C — copy selected
 * Cmd+V — paste offset from copied component positions (or viewport center if no clipboard / anchor)
 * Cmd+D — duplicate (copy + paste with offset)
 */
export function useCopyPasteShortcuts({
  diagram,
  selectedNodeId,
  reactFlowInstance,
  reactFlowWrapperRef,
  copyToClipboard,
  pasteFromClipboard,
  importDrawioResult,
  pasteSvgAsCanvasNode,
  importSvgForIconLibrary,
  serviceRegistry,
  exportDrawioXml,
  setSelectedNodeIds,
  pastedSvgDefaultName,
}: UseCopyPasteShortcutsParams): KeyHandler {
  return useCallback(
    async (event: KeyboardEvent): Promise<boolean> => {
      if (!diagram) return false;
      const mod = isModKeyPressed(event);
      if (!mod) return false;

      // Cmd/Ctrl+C — copy
      if (event.key === "c") {
        event.preventDefault();
        const nodes = getSelectedNodes(reactFlowInstance, selectedNodeId);
        const ids = getCopyableIds(diagram, nodes);
        if (ids.length > 0) {
          // 1. Write to Zustand clipboard (for canvas paste via Cmd+V)
          copyToClipboard(ids);
          // 2. Write drawio XML of selected nodes to system clipboard
          const xml = exportDrawioXml(ids);
          void writeDrawioToClipboard(xml);
        }
        return true;
      }

      // Cmd/Ctrl+V — SVG clipboard, then draw.io, then plain-text SVG → icon library, then internal clipboard
      if (event.key === "v") {
        event.preventDefault();

        // 1. Try SVG clipboard first (image/svg+xml or text/plain SVG via Clipboard API)
        const svgContent = await readSvgFromClipboard();
        if (svgContent) {
          const pastePos = getPasteCenter(reactFlowInstance, reactFlowWrapperRef);
          const newId = pasteSvgAsCanvasNode(svgContent, pastePos);
          if (newId) {
            reactFlowInstance.setNodes((nodes) =>
              nodes.map((n) => ({ ...n, selected: n.id === newId })),
            );
            setSelectedNodeIds(new Set([newId]));
          }
          return true;
        }

        // 2. Try draw.io clipboard
        const drawioXml = await readDrawioFromClipboard();
        if (drawioXml) {
          const pasteCenter = getPasteCenter(reactFlowInstance, reactFlowWrapperRef);
          const result = parseDrawioXml(drawioXml, pasteCenter, serviceRegistry);
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

        // 3. Inline SVG from system clipboard text → diagram icon library (fallback when readSvgFromClipboard is empty)
        let clipboardPlain: string | null = null;
        try {
          clipboardPlain = await navigator.clipboard.readText();
        } catch {
          clipboardPlain = null;
        }
        if (clipboardPlain && /<svg(\s|>)/i.test(clipboardPlain)) {
          const cleanedMarkup = importSvgForIconLibrary(clipboardPlain);
          if (cleanedMarkup === null) {
            return true;
          }
          const store = useDiagramStore.getState();
          const activeDiagramId = store.activeDiagramId;
          if (activeDiagramId) {
            const newIconId = generateIconId();
            store.addIcon(activeDiagramId, {
              id: newIconId,
              name: pastedSvgDefaultName,
              source: {
                kind: "svg",
                svgContent: normalizeSvgForStorage(cleanedMarkup),
              },
              createdAt: Date.now(),
              usageCount: 0,
            });
          }
          return true;
        }

        // 4. Fall back to internal Zustand clipboard
        const clipboardIds =
          useDiagramStore.getState().clipboard?.components.map((component) => component.id) ??
          [];

        const offsetPos =
          diagram && clipboardIds.length > 0
            ? getOffsetPositionOfNodes(diagram, clipboardIds)
            : null;

        const pastePos =
          offsetPos ?? getPasteCenter(reactFlowInstance, reactFlowWrapperRef);
        const newIds = pasteFromClipboard(pastePos);
        if (newIds.length > 0) {
          reactFlowInstance.setNodes((nodes) =>
            nodes.map((node) => ({ ...node, selected: newIds.includes(node.id) })),
          );
          setSelectedNodeIds(new Set(newIds));
        }
        return true;
      }

      // Cmd/Ctrl+D — duplicate
      if (event.key === "d") {
        event.preventDefault();
        const selectedNodes = getSelectedNodes(reactFlowInstance, selectedNodeId);
        const ids = getCopyableIds(diagram, selectedNodes);
        if (ids.length === 0) return true;

        const canvasSnapshot = resolveCanvasSnapshot(diagram);
        const originalSelectedIds = selectedNodes
          .map((node) => node.id)
          .filter((id) => Boolean(canvasSnapshot.components[id]));
        const originalSelectedComponents = originalSelectedIds
          .map((id) => canvasSnapshot.components[id])
          .filter((component): component is NonNullable<typeof component> => Boolean(component));
        const parentIds = new Set(
          originalSelectedComponents
            .map((component) => component.parentId)
            .filter((parentId): parentId is string => Boolean(parentId)),
        );
        const allChildrenOfSamePanel =
          parentIds.size === 1 &&
          originalSelectedComponents.every((component) => component.parentId !== null) &&
          !originalSelectedComponents.some((component) => isPanelComponent(component));

        copyToClipboard(ids);
        const center = getCenterOfNodes(
          diagram,
          allChildrenOfSamePanel ? originalSelectedIds : ids,
        );
        const newIds = allChildrenOfSamePanel
          ? pasteFromClipboard(center, { preserveParentWhenMissing: true })
          : pasteFromClipboard(center);
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
      pasteSvgAsCanvasNode,
      importSvgForIconLibrary,
      serviceRegistry,
      exportDrawioXml,
      setSelectedNodeIds,
      pastedSvgDefaultName,
    ],
  );
}
