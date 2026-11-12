import type { Node } from "@xyflow/react";
import type { Diagram, DiagramModel, ResolvedSnapshot } from "@/features/diagram";
import {
  SaveElementPresetModal,
  useElementPresetStore,
  createPresetDataFromNode,
} from "@/features/element-presets";
import { CanvasContextMenu } from "../panels/CanvasContextMenu";
import QuickInsertPopover from "../toolbar/QuickInsertPopover";
import { DiagramCommandPalette } from "../navigation/DiagramCommandPalette";
import type { CanvasVisualState } from "../hooks/useCanvasVisualState";

interface CanvasOverlaysProps {
  diagram: Diagram | DiagramModel;
  resolvedSnapshot: ResolvedSnapshot;
  nodes: Node[];
  visualState: CanvasVisualState;
  canEditCanvas: boolean;
  onAutoLayout: () => void;
  isAutoLayoutRunning: boolean;
  onQuickInsert: (newNodeId: string) => void;
  showCommandPalette: boolean;
  onCloseCommandPalette: () => void;
  onSelectDiagram: (id: string) => void;
  /** The node the "save as preset" dialog is open for. Held by the canvas, so it outlives an empty canvas. */
  templateNodeId: string | null;
  onTemplateNodeIdChange: (nodeId: string | null) => void;
}

/**
 * What opens over the canvas on demand: the node context menu, quick insert,
 * the diagram command palette, and the "save as preset" dialog the context
 * menu leads to.
 */
export function CanvasOverlays({
  diagram,
  resolvedSnapshot,
  nodes,
  visualState,
  canEditCanvas,
  onAutoLayout,
  isAutoLayoutRunning,
  onQuickInsert,
  showCommandPalette,
  onCloseCommandPalette,
  onSelectDiagram,
  templateNodeId,
  onTemplateNodeIdChange: setTemplateNodeId,
}: CanvasOverlaysProps) {
  const addPreset = useElementPresetStore((state) => state.addPreset);
  const templateSourceNode = templateNodeId
    ? (nodes.find((node) => node.id === templateNodeId) ?? null)
    : null;

  return (
    <>
      {visualState.contextMenu && (
        <CanvasContextMenu
          contextMenu={visualState.contextMenu}
          diagram={diagram}
          resolvedSnapshot={resolvedSnapshot}
          selectedNodeIds={visualState.selectedNodeIds}
          canEditCanvas={canEditCanvas}
          onSaveAsTemplate={setTemplateNodeId}
          onAutoLayout={onAutoLayout}
          isAutoLayoutRunning={isAutoLayoutRunning}
          onClose={() => visualState.setContextMenu(null)}
        />
      )}

      {visualState.quickInsert && (
        <QuickInsertPopover
          screenPos={visualState.quickInsert.screenPos}
          flowPos={visualState.quickInsert.flowPos}
          sourceNodeId={visualState.quickInsert.sourceNodeId}
          sourceName={
            visualState.quickInsert.sourceNodeId
              ? resolvedSnapshot.components[visualState.quickInsert.sourceNodeId]?.name
              : undefined
          }
          onInsert={onQuickInsert}
          onClose={() => visualState.setQuickInsert(null)}
        />
      )}

      {showCommandPalette && (
        <DiagramCommandPalette onClose={onCloseCommandPalette} onSelectDiagram={onSelectDiagram} />
      )}

      {templateSourceNode ? (
        <SaveElementPresetModal
          defaultName={String(
            resolvedSnapshot.components[templateSourceNode.id]?.name ??
              templateSourceNode.data?.name ??
              "",
          )}
          defaultDescription={
            resolvedSnapshot.components[templateSourceNode.id]?.description ??
            (typeof templateSourceNode.data?.description === "string"
              ? templateSourceNode.data.description
              : undefined)
          }
          onClose={() => setTemplateNodeId(null)}
          onSave={(name, description) => {
            const domainComponent = resolvedSnapshot.components[templateSourceNode.id];
            const templateData = createPresetDataFromNode(templateSourceNode, domainComponent);
            addPreset({
              id: crypto.randomUUID(),
              name,
              description,
              baseType: templateData.baseType,
              data: templateData.data,
              serviceId: templateData.serviceId,
              templateVersion: 1,
              category: "general",
              createdAt: Date.now(),
              updatedAt: Date.now(),
            });
            setTemplateNodeId(null);
          }}
        />
      ) : null}
    </>
  );
}
