import { useCallback } from "react";
import {
  isApiGroupComponent,
  isPanelComponent,
  isTextComponent,
  useResolvedComponents,
  type Component,
  type useDiagramActions,
} from "@/features/diagram";
import { NodeQuickActionsBar } from "../selection-actions/NodeQuickActionsBar";
import { TextStyleToolbar } from "../selection-actions/TextStyleToolbar";
import { usePanelChildLayout } from "../hooks/usePanelChildLayout";

type DiagramActions = ReturnType<typeof useDiagramActions>;

interface SelectionToolbarsProps {
  /** The primary selected node; the toolbars show for a single selected node only. */
  nodeId: string | null;
  selectedCount: number;
  component: Component | null;
  canEditCanvas: boolean;
  diagramId: string;
  actions: DiagramActions;
  onFocusElement: (componentId: string) => void;
}

/**
 * The floating bar over a single selected node: the text style bar for a text,
 * the quick actions for anything else. Gated on the same flag as the element
 * panel: the bar edits the element, so it has no place in a reading or a
 * comparison — and a selection made before either began would otherwise carry
 * it in.
 */
export function SelectionToolbars({
  nodeId,
  selectedCount,
  component,
  canEditCanvas,
  diagramId,
  actions,
  onFocusElement,
}: SelectionToolbarsProps) {
  // QuickActionsBar context: detect panel-with-children vs child-of-panel
  const resolvedComponents = useResolvedComponents();
  const isSelectedPanel = !!component && isPanelComponent(component);
  const isSelectedApiGroup = !!component && isApiGroupComponent(component);
  const parentComp = component?.parentId ? resolvedComponents[component.parentId] : undefined;
  const isSelectedChildOfGroup =
    !!component?.parentId &&
    !!parentComp &&
    (isPanelComponent(parentComp) || isApiGroupComponent(parentComp));
  const hasPanelChildren =
    (isSelectedPanel || isSelectedApiGroup) &&
    Object.values(resolvedComponents).some((c) => c.parentId === nodeId);

  const { runPanelChildLayout, isRunning: isPanelLayoutRunning } = usePanelChildLayout();
  const handleUngroup = useCallback(() => {
    if (!nodeId) return;
    actions.ungroupNodes(nodeId);
  }, [actions, nodeId]);
  const handleFitToChildren = useCallback(() => {
    if (!nodeId) return;
    actions.fitGroupToChildren(nodeId);
  }, [actions, nodeId]);
  const handleOrganizeChildren = useCallback(() => {
    if (!nodeId) return;
    runPanelChildLayout(nodeId);
  }, [runPanelChildLayout, nodeId]);
  const handleRemoveFromGroup = useCallback(() => {
    if (!component?.parentId) return;
    actions.setParent(nodeId!, null);
  }, [actions, component?.parentId, nodeId]);

  if (!nodeId || selectedCount !== 1 || !canEditCanvas) return null;

  if (component && isTextComponent(component)) {
    return (
      <TextStyleToolbar
        nodeId={nodeId}
        component={component}
        onChange={(patch) => actions.updateComponent(nodeId, patch)}
        onDelete={() => actions.removeComponent(nodeId)}
      />
    );
  }

  const isGroupWithChildren = (isSelectedPanel || isSelectedApiGroup) && hasPanelChildren;
  const isCollapsed = !!(component as { collapsed?: boolean } | null)?.collapsed;
  return (
    <NodeQuickActionsBar
      nodeId={nodeId}
      diagramId={diagramId}
      updateComponent={actions.updateComponent}
      onUngroup={isGroupWithChildren ? handleUngroup : undefined}
      onFitToChildren={isGroupWithChildren && !isCollapsed ? handleFitToChildren : undefined}
      onOrganizeChildren={
        isGroupWithChildren && !isCollapsed && !isPanelLayoutRunning
          ? handleOrganizeChildren
          : undefined
      }
      onRemoveFromGroup={isSelectedChildOfGroup ? handleRemoveFromGroup : undefined}
      onFocusElement={onFocusElement}
    />
  );
}
