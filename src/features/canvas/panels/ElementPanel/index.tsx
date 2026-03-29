import { LayoutDashboard } from "lucide-react";
import { CollabEditingWarning } from "@/features/collaboration";
import {
  useComponent,
  useConnections,
  useComponents,
  useDiagramActions,
  useActiveDiagram,
  useFlows,
  isEndpointComponent,
  isApiGroupComponent,
  isJsonViewerComponent,
  isPanelComponent,
} from "@/features/diagram";
import type { Node } from "@xyflow/react";
import { MultiSelectPanel } from "../MultiSelectPanel";
import ComponentPanel from "./ComponentPanel";
import ConnectionPanel from "./ConnectionPanel";
import EndpointPanel from "./EndpointPanel";
import ApiGroupPanel from "./ApiGroupPanel";
import JsonViewerPanel from "./JsonViewerPanel";

interface Props {
  selectedElementId: string | null;
  selectedEdgeId: string | null;
  selectedNodeIds?: string[];
  selectedNodes?: Node[];
  focusTitleTrigger?: number;
  onClose: () => void;
}

const ElementPanel = ({
  selectedElementId,
  selectedEdgeId,
  selectedNodeIds = [],
  selectedNodes = [],
  focusTitleTrigger = 0,
  onClose,
}: Props) => {
  const component = useComponent(selectedElementId ?? "");
  const resolvedComponents = useComponents();
  const connections = useConnections();
  const flows = useFlows();
  const { updateComponent, removeComponent, updateConnection, removeConnection, groupNodes, ungroupNodes } = useDiagramActions();
  const diagram = useActiveDiagram();
  const availableFlows = flows.map((f) => ({ id: f.id, name: f.name }));

  if (selectedNodes.length > 1) {
    return <MultiSelectPanel selectedNodes={selectedNodes} onClose={onClose} />;
  }

  if (selectedEdgeId) {
    const conn = connections[selectedEdgeId];
    if (!conn) return null;
    return (
      <div className="w-80 h-full min-h-0 border-l border-border bg-card overflow-hidden flex flex-col">
        <CollabEditingWarning elementId={selectedEdgeId} />
        <ConnectionPanel conn={conn} onClose={onClose} updateConnection={updateConnection} removeConnection={removeConnection} focusTitleTrigger={focusTitleTrigger} />
      </div>
    );
  }

  if (selectedElementId && component) {
    const canGroup = selectedNodeIds.length >= 2;
    const isPanelWithChildren =
      isPanelComponent(component) &&
      Object.values(resolvedComponents).some((c) => c.parentId === component.id);

    if (isEndpointComponent(component)) {
      return (
        <div className="w-80 h-full min-h-0 border-l border-border bg-card overflow-hidden flex flex-col">
          <CollabEditingWarning elementId={selectedElementId} />
          <EndpointPanel
            component={component}
            onClose={onClose}
            updateComponent={updateComponent}
            removeComponent={removeComponent}
            availableFlows={availableFlows}
          />
        </div>
      );
    }

    if (isJsonViewerComponent(component)) {
      return (
        <div className="w-80 h-full min-h-0 border-l border-border bg-card overflow-hidden flex flex-col">
          <CollabEditingWarning elementId={selectedElementId} />
          <JsonViewerPanel
            component={component}
            onClose={onClose}
            updateComponent={updateComponent}
            removeComponent={removeComponent}
            focusTitleTrigger={focusTitleTrigger}
          />
        </div>
      );
    }

    if (isApiGroupComponent(component)) {
      return (
        <div className="w-80 h-full min-h-0 border-l border-border bg-card overflow-hidden flex flex-col">
          <CollabEditingWarning elementId={selectedElementId} />
          <ApiGroupPanel
            component={component}
            onClose={onClose}
            updateComponent={updateComponent}
            removeComponent={removeComponent}
          />
        </div>
      );
    }

    return (
      <div className="w-80 h-full min-h-0 border-l border-border bg-card overflow-hidden flex flex-col">
        <CollabEditingWarning elementId={selectedElementId} />
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
          focusTitleTrigger={focusTitleTrigger}
        />
      </div>
    );
  }

  return null;
};

export default ElementPanel;
