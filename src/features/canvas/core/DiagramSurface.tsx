import type { ReactNode } from "react";
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  type NodeTypes,
  type ReactFlowProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { ComponentIconLookup } from "../components/icons/componentIconLookupContext";
import { ComponentIconLookupProvider } from "../components/icons/ComponentIconLookupProvider";
import { ElementsSelectableProvider } from "../contexts/ElementsSelectableContext";
import { EdgeLabelPortalHost, EdgeLabelPortalProvider } from "../edges/EdgeLabelPortal";
import type { CanvasInputProfile } from "../hooks/useCanvasInputProfile";
import type { DiagramSurfacePolicy } from "./canvasInteractionPolicy";
import { diagramEdgeTypes } from "./edgeTypes";
import { buildReactFlowShellProps } from "./reactFlowBaseConfig";

type FlowHandlerProps = Pick<
  ReactFlowProps,
  | "nodes"
  | "edges"
  | "onNodesChange"
  | "onEdgesChange"
  | "onConnect"
  | "onConnectEnd"
  | "onReconnect"
  | "onReconnectStart"
  | "onReconnectEnd"
  | "onNodeClick"
  | "onEdgeClick"
  | "onNodeDoubleClick"
  | "onEdgeDoubleClick"
  | "onPaneClick"
  | "onPaneContextMenu"
  | "onNodeContextMenu"
  | "onNodeDragStop"
  | "onSelectionChange"
  | "onMoveEnd"
  | "defaultViewport"
  | "fitView"
  | "fitViewOptions"
  | "nodeDragThreshold"
>;

export interface DiagramSurfaceProps extends FlowHandlerProps {
  policy: DiagramSurfacePolicy;
  nodeTypes: NodeTypes;
  /** Optional diagram-scoped icon lookup (viewer / embed). */
  iconLookup?: ComponentIconLookup;
  inputProfile?: CanvasInputProfile;
  snapToGrid?: boolean;
  /** Content inside `<ReactFlow>` (Controls, MiniMap, toolbars). */
  children?: ReactNode;
}

/**
 * Shared React Flow shell for Write and Reader hosts.
 *
 * Owns providers, edge types, base RF props from policy, Background, and the
 * single EdgeLabelPortal host. Product chrome (toolbar, invite, LLM) stays in
 * the host.
 *
 * @example
 * <DiagramSurface policy={readPolicy()} nodes={nodes} edges={edges} nodeTypes={nodeTypes}>
 *   <Controls />
 * </DiagramSurface>
 */
export function DiagramSurface({
  policy,
  nodes,
  edges,
  nodeTypes,
  iconLookup,
  inputProfile,
  snapToGrid,
  nodeDragThreshold,
  fitView,
  fitViewOptions,
  defaultViewport,
  onMoveEnd,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onConnectEnd,
  onReconnect,
  onReconnectStart,
  onReconnectEnd,
  onNodeClick,
  onEdgeClick,
  onNodeDoubleClick,
  onEdgeDoubleClick,
  onPaneClick,
  onPaneContextMenu,
  onNodeContextMenu,
  onNodeDragStop,
  onSelectionChange,
  children,
}: DiagramSurfaceProps) {
  const shell = buildReactFlowShellProps(policy, { inputProfile, snapToGrid });
  const resolvedFitViewOptions = fitViewOptions ?? shell.fitViewOptions;

  const flow = (
    <ElementsSelectableProvider value={policy.graphInteractive}>
      <EdgeLabelPortalProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={diagramEdgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectEnd={onConnectEnd}
          onReconnect={onReconnect}
          onReconnectStart={onReconnectStart}
          onReconnectEnd={onReconnectEnd}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onNodeDoubleClick={onNodeDoubleClick}
          onEdgeDoubleClick={onEdgeDoubleClick}
          onPaneClick={onPaneClick}
          onPaneContextMenu={onPaneContextMenu}
          onNodeContextMenu={onNodeContextMenu}
          onNodeDragStop={onNodeDragStop}
          onSelectionChange={onSelectionChange}
          panOnDrag={shell.panOnDrag}
          panOnScroll={shell.panOnScroll}
          panOnScrollMode={shell.panOnScrollMode}
          selectionOnDrag={shell.selectionOnDrag}
          panActivationKeyCode={shell.panActivationKeyCode}
          selectionMode={shell.selectionMode}
          zoomOnScroll={shell.zoomOnScroll}
          zoomOnPinch={shell.zoomOnPinch}
          zoomOnDoubleClick={shell.zoomOnDoubleClick}
          deleteKeyCode={shell.deleteKeyCode}
          minZoom={shell.minZoom}
          maxZoom={shell.maxZoom}
          multiSelectionKeyCode={
            shell.multiSelectionKeyCode ? [...shell.multiSelectionKeyCode] : undefined
          }
          selectionKeyCode={shell.selectionKeyCode}
          nodeDragThreshold={nodeDragThreshold}
          snapToGrid={shell.snapToGrid}
          snapGrid={shell.snapGrid}
          defaultViewport={defaultViewport}
          fitView={fitView}
          fitViewOptions={resolvedFitViewOptions}
          onMoveEnd={onMoveEnd}
          nodesDraggable={shell.nodesDraggable}
          nodesConnectable={shell.nodesConnectable}
          elementsSelectable={shell.elementsSelectable}
          proOptions={{ ...shell.proOptions }}
          className={shell.className}
        >
          <EdgeLabelPortalHost />
          <Background
            variant={BackgroundVariant.Lines}
            gap={10}
            lineWidth={1}
            color="hsl(var(--muted) / 0.6)"
          />
          {children}
        </ReactFlow>
      </EdgeLabelPortalProvider>
    </ElementsSelectableProvider>
  );

  if (iconLookup) {
    return <ComponentIconLookupProvider lookup={iconLookup}>{flow}</ComponentIconLookupProvider>;
  }

  return flow;
}
