import { LayoutDashboard } from "lucide-react";
import { useComponent, useConnections, useDiagramActions, useActiveDiagram } from "@/features/diagram";
import type { Node } from "@xyflow/react";
import { MultiSelectPanel } from "../MultiSelectPanel";
import ComponentPanel from "./ComponentPanel";
import ConnectionPanel from "./ConnectionPanel";

interface Props {
  selectedElementId: string | null;
  selectedEdgeId: string | null;
  selectedNodeIds?: string[];
  selectedNodes?: Node[];
  onClose: () => void;
}

const ElementPanel = ({
  selectedElementId,
  selectedEdgeId,
  selectedNodeIds = [],
  selectedNodes = [],
  onClose,
}: Props) => {
  const component = useComponent(selectedElementId ?? "");
  const connections = useConnections();
  const { updateComponent, removeComponent, updateConnection, removeConnection, groupNodes, ungroupNodes } = useDiagramActions();
  const diagram = useActiveDiagram();

  if (selectedNodes.length > 1) {
    return <MultiSelectPanel selectedNodes={selectedNodes} onClose={onClose} />;
  }

  if (selectedEdgeId) {
    const conn = connections[selectedEdgeId];
    if (!conn) return null;
    return <ConnectionPanel conn={conn} onClose={onClose} updateConnection={updateConnection} removeConnection={removeConnection} />;
  }

  if (selectedElementId && component) {
    const canGroup = selectedNodeIds.length >= 2;
    const isPanelWithChildren =
      component.type === "panel" &&
      diagram &&
      Object.values(diagram.snapshot.components).some((c) => c.parentId === component.id);

    return (
      <div className="w-80 border-l border-border bg-card overflow-auto flex flex-col">
        {canGroup && (
          <div className="flex items-center gap-2 p-2 border-b border-border bg-secondary/30">
            <button
              type="button"
              onClick={() => { const id = groupNodes(selectedNodeIds); if (id) onClose(); }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              Agrupar
            </button>
          </div>
        )}
        <ComponentPanel
          component={component}
          onClose={onClose}
          updateComponent={updateComponent}
          removeComponent={removeComponent}
          onUngroup={isPanelWithChildren ? () => { ungroupNodes(component.id); onClose(); } : undefined}
        />
      </div>
    );
  }

  return null;
};

export default ElementPanel;
