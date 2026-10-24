import { useResolvedComponents } from "@/features/diagram";
import { isSharedRefComponent } from "@/features/diagram/model/component.guards";
import { resolveShared } from "@/features/diagram/utils/shared";
import { LayoutDashboard } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CollabEditingWarning } from "@/features/collaboration";
import { useComponent, useConnections, useDiagramActions } from "@/features/diagram";
import type { Node } from "@xyflow/react";
import { PluginPanelSlot } from "@/features/plugins/components/PluginPanelSlot";
import { MultiSelectPanel } from "../MultiSelectPanel";
import { getElement } from "@/features/elements/element.registry";
import ComponentPanel from "./ComponentPanel";
import ConnectionPanel from "./ConnectionPanel";
import DiagramPanel from "./DiagramPanel";
import { PanelFrame } from "./shell";

interface Props {
  selectedElementId: string | null;
  selectedEdgeId: string | null;
  selectedNodeIds?: string[];
  selectedNodes?: Node[];
  focusTitleTrigger?: number;
  onFocusElement?: (componentId: string) => void;
  onTogglePanelCollapse?: (componentId: string) => void;
  onClose: () => void;
}

const ElementPanel = ({
  selectedElementId,
  selectedEdgeId,
  selectedNodeIds = [],
  selectedNodes = [],
  focusTitleTrigger = 0,
  onFocusElement,
  onTogglePanelCollapse,
  onClose,
}: Props) => {
  const { t } = useTranslation();
  const selected = useComponent(selectedElementId ?? "");
  const resolvedComponents = useResolvedComponents();
  // A reference has no data of its own: selecting it inspects — and edits —
  // the shared element it stands for.
  const component =
    selected && isSharedRefComponent(selected)
      ? (resolvedComponents[resolveShared(selected.id, resolvedComponents)] ?? selected)
      : selected;
  const connections = useConnections();
  const { updateComponent, removeComponent, updateConnection, removeConnection, groupNodes } =
    useDiagramActions();

  if (selectedNodes.length > 1) {
    return <MultiSelectPanel selectedNodes={selectedNodes} onClose={onClose} />;
  }

  if (selectedEdgeId) {
    const conn = connections[selectedEdgeId];
    if (!conn) return null;
    return (
      <PanelFrame>
        <CollabEditingWarning elementId={selectedEdgeId} />
        <ConnectionPanel
          conn={conn}
          onClose={onClose}
          updateConnection={updateConnection}
          removeConnection={removeConnection}
          focusTitleTrigger={focusTitleTrigger}
          onFocusElement={onFocusElement}
        />
      </PanelFrame>
    );
  }

  if (selectedElementId && component) {
    // Registered elements answer first; the guard chain below still owns every
    // type that has not migrated.
    const RegisteredPanel = getElement(component.type)?.inspector.panel;
    if (RegisteredPanel) {
      return (
        <PanelFrame>
          <CollabEditingWarning elementId={selectedElementId} />
          <RegisteredPanel
            component={component}
            onClose={onClose}
            updateComponent={updateComponent}
            removeComponent={removeComponent}
            focusTitleTrigger={focusTitleTrigger}
            onFocusElement={onFocusElement}
          />
        </PanelFrame>
      );
    }

    const canGroup = selectedNodeIds.length >= 2;

    return (
      <PanelFrame>
        <CollabEditingWarning elementId={selectedElementId} />
        {canGroup && (
          <div className="flex items-center gap-2 p-2 border-b border-border bg-secondary/30">
            <button
              type="button"
              onClick={() => {
                const id = groupNodes(selectedNodeIds);
                if (id) onClose();
              }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              {t("multiSelect.group")}
            </button>
          </div>
        )}
        <ComponentPanel
          component={component}
          onClose={onClose}
          updateComponent={updateComponent}
          removeComponent={removeComponent}
          focusTitleTrigger={focusTitleTrigger}
          onFocusElement={onFocusElement}
          onTogglePanelCollapse={onTogglePanelCollapse}
        />
        <div className="shrink-0 overflow-y-auto p-2 empty:hidden">
          <PluginPanelSlot slot="element-inspector" selectionIds={[selectedElementId]} />
        </div>
      </PanelFrame>
    );
  }

  return (
    <PanelFrame>
      <DiagramPanel />
    </PanelFrame>
  );
};

export default ElementPanel;
