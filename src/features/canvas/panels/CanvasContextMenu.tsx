import { useReactFlow } from "@xyflow/react";
import type { Diagram, DiagramModel, ResolvedSnapshot } from "@/features/diagram";
import { isApiGroupComponent, isPanelComponent, useDiagramActions } from "@/features/diagram";
import NodeContextMenu from "./NodeContextMenu";
import { getCenterOfNodes, getCopyableIds, getPlatform } from "../hooks/keyboard/helpers";

interface CanvasContextMenuProps {
  contextMenu: { x: number; y: number; elementId: string };
  diagram: Diagram | DiagramModel;
  resolvedSnapshot: ResolvedSnapshot;
  selectedNodeIds: Set<string>;
  canEditCanvas: boolean;
  onSaveAsTemplate: (nodeId: string) => void;
  onAutoLayout: () => void;
  isAutoLayoutRunning: boolean;
  onClose: () => void;
}

/**
 * Container for the node context menu: derives the effective selection and
 * wires copy/paste/group/ungroup/etc. handlers to store actions.
 */
export function CanvasContextMenu({
  contextMenu,
  diagram,
  resolvedSnapshot,
  selectedNodeIds,
  canEditCanvas,
  onSaveAsTemplate,
  onAutoLayout,
  isAutoLayoutRunning,
  onClose,
}: CanvasContextMenuProps) {
  const reactFlowInstance = useReactFlow();
  const actions = useDiagramActions();

  const contextMenuId = contextMenu.elementId;
  const contextMenuComponent = resolvedSnapshot.components[contextMenuId];
  const isContextMenuIdSelected = selectedNodeIds.has(contextMenuId);
  const effectiveIds =
    isContextMenuIdSelected && selectedNodeIds.size > 1 ? [...selectedNodeIds] : [contextMenuId];
  const selectionCount = effectiveIds.length;
  const effectiveNodes = reactFlowInstance
    .getNodes()
    .filter((node) => effectiveIds.includes(node.id));

  const handleCopy = canEditCanvas
    ? () => {
        const copyableIds = getCopyableIds(diagram, effectiveNodes);
        if (copyableIds.length > 0) {
          actions.copyToClipboard(copyableIds);
        }
      }
    : undefined;

  const selectPastedNodes = (newIds: string[]) => {
    if (newIds.length === 0) return;
    reactFlowInstance.setNodes((previousNodes) =>
      previousNodes.map((node) => ({ ...node, selected: newIds.includes(node.id) })),
    );
  };

  const handlePaste = canEditCanvas
    ? () => {
        const pasteCenter = getCenterOfNodes(diagram, effectiveIds);
        const newIds = actions.pasteFromClipboard(pasteCenter);
        selectPastedNodes(newIds);
      }
    : undefined;

  const handleDuplicate = canEditCanvas
    ? () => {
        const copyableIds = getCopyableIds(diagram, effectiveNodes);
        if (copyableIds.length === 0) return;
        actions.copyToClipboard(copyableIds);
        const pasteCenter = getCenterOfNodes(diagram, copyableIds);
        const newIds = actions.pasteFromClipboard(pasteCenter);
        selectPastedNodes(newIds);
      }
    : undefined;

  const handleDelete = canEditCanvas
    ? () => {
        for (const selectedId of effectiveIds) {
          actions.removeComponent(selectedId);
        }
      }
    : undefined;

  const canGroup =
    canEditCanvas &&
    effectiveIds.length >= 2 &&
    effectiveIds.every((selectedId) => {
      const selectedComponent = resolvedSnapshot.components[selectedId];
      return !!selectedComponent && !isApiGroupComponent(selectedComponent);
    });
  const handleGroup = canGroup ? () => actions.groupNodes(effectiveIds) : undefined;

  const canUngroup =
    canEditCanvas &&
    effectiveIds.length === 1 &&
    !!contextMenuComponent &&
    (isPanelComponent(contextMenuComponent) || !!contextMenuComponent.parentId);
  const handleUngroup = canUngroup
    ? () => {
        if (contextMenuComponent && isPanelComponent(contextMenuComponent)) {
          actions.ungroupNodes(contextMenuId);
          return;
        }

        if (contextMenuComponent?.parentId) {
          const parentLayout = resolvedSnapshot.nodeLayouts[contextMenuComponent.parentId];
          const childLayout = resolvedSnapshot.nodeLayouts[contextMenuId];
          if (!parentLayout || !childLayout) return;

          actions.setParent(contextMenuId, null);
          actions.updateNodeLayout(contextMenuId, {
            x: childLayout.x + parentLayout.x,
            y: childLayout.y + parentLayout.y,
          });
        }
      }
    : undefined;

  // Lock toggle is provided for every node that has a `locked` flag (i.e. all
  // built-in components). It is the only way to unlock a node that's already
  // locked — the quick-actions bar is hidden on locked nodes.
  const handleToggleLock =
    canEditCanvas && contextMenuComponent ? (
      () => {
        const locked = contextMenuComponent.locked === true;
        actions.updateComponent(contextMenuId, { locked: !locked });
      }
    ) : undefined;

  return (
    <NodeContextMenu
      x={contextMenu.x}
      y={contextMenu.y}
      elementId={contextMenuId}
      onBringToFront={actions.bringToFront}
      onSendToBack={actions.sendToBack}
      onSaveAsTemplate={onSaveAsTemplate}
      onFitToChildren={
        contextMenuComponent && isPanelComponent(contextMenuComponent)
          ? actions.fitGroupToChildren
          : undefined
      }
      onClose={onClose}
      onCopy={handleCopy}
      onPaste={handlePaste}
      onDuplicate={handleDuplicate}
      onDelete={handleDelete}
      onGroup={handleGroup}
      onUngroup={handleUngroup}
      onToggleLock={handleToggleLock}
      isLocked={contextMenuComponent?.locked === true}
      onAutoLayout={canEditCanvas ? onAutoLayout : undefined}
      isAutoLayoutRunning={isAutoLayoutRunning}
      selectionCount={selectionCount}
      platform={getPlatform()}
    />
  );
}
