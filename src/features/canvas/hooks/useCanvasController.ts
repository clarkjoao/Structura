import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useReactFlow, useUpdateNodeInternals } from "@xyflow/react";
import { useNavigate } from "react-router-dom";
import { resolveCanvasSnapshot } from "@/features/diagram";
import type { CanvasProps } from "../canvas.types";
import { useCanvasCompareState } from "./useCanvasCompareState";
import { useCanvasFlowState } from "./useCanvasFlowState";
import { useCanvasGraphState } from "./useCanvasGraphState";
import { useCanvasInteraction } from "./useCanvasInteraction";
import { useCanvasStore } from "./useCanvasStore";
import { useCanvasVisualState } from "./useCanvasVisualState";

export function useCanvasController(canvasProps: CanvasProps = {}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const reactFlowInstance = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const reactFlowWrapperRef = useRef<HTMLDivElement>(null);
  const [showScenes, setShowScenes] = useState(false);
  const [focusTitleTrigger, setFocusTitleTrigger] = useState(0);
  const { diagram, allDiagrams, visibleComponents, visibleConnections, serviceRegistry, flows, actions } = useCanvasStore();
  const visualState = useCanvasVisualState(diagram?.id ?? null);
  const compareState = useCanvasCompareState({ diagram, isFlowPanelOpen: !!canvasProps.isFlowPanelOpen, clearCanvasSelection: visualState.clearCanvasSelection, t });
  const resolved = useMemo(() => (diagram ? resolveCanvasSnapshot(diagram) : null), [diagram]);
  const allDiagramTags = useMemo(() => {
    if (!resolved?.components) return [];
    const tags = new Set<string>();
    Object.values(resolved.components).forEach((component) => component.tags?.forEach((tag) => tags.add(tag)));
    return Array.from(tags).sort();
  }, [resolved?.components]);
  const flowState = useCanvasFlowState({ flows, isCompareMode: compareState.isCompareMode });
  const interaction = useCanvasInteraction({ canvasProps, navigate, reactFlowInstance, reactFlowWrapperRef, visualState, diagram, allDiagrams, actions, serviceRegistry, compareState, flowState, showScenes, setShowScenes, setFocusTitleTrigger });
  const graphState = useCanvasGraphState({ diagram, resolved, visualState, localNodesRef: interaction.localNodesRef, innerOnNodesChange: interaction.innerOnNodesChange, dragTargetPanelId: interaction.dragTargetPanelId, unparentCandidatePanelId: interaction.unparentCandidatePanelId, visibleComponents, visibleConnections, serviceRegistry, allDiagrams, compareState, flowState, handleDrillDown: interaction.handleDrillDown, handlePanelCollapseToggle: interaction.handlePanelCollapseToggle, actions, isViewingCoverage: !!canvasProps.isViewingCoverage, onPlayFlow: canvasProps.onPlayFlow, updateNodeInternals, t });
  const selectedNodes = graphState.nodes.filter((node) => visualState.selectedNodeIds.has(node.id));
  const selectedCount = visualState.selectedNodeIds.size;
  const showElementPanel = (visualState.selectedNodeId || visualState.selectedEdgeId || selectedCount > 0) && !flowState.isRecording && !compareState.isCompareMode;
  return { t, diagram, reactFlowWrapperRef, visualState, nodes: graphState.nodes, edges: graphState.edges, onNodesChange: graphState.onNodesChange, onNodeDragStop: interaction.onNodeDragStop, eventHandlers: interaction.eventHandlers, isRecording: flowState.isRecording, actions, showSearch: interaction.showSearch, setShowSearch: interaction.setShowSearch, showDiagramSidebar: interaction.showDiagramSidebar, setShowDiagramSidebar: interaction.setShowDiagramSidebar, showCommandPalette: interaction.showCommandPalette, setShowCommandPalette: interaction.setShowCommandPalette, showScenes, setShowScenes, handleSelectDiagram: interaction.handleSelectDiagram, handleSearchSelect: interaction.handleSearchSelect, focusTitleTrigger, isPanelOpen: interaction.isPanelOpen, selectedNodes, selectedCount, showElementPanel, onDrillUp: canvasProps.onDrillUp, isCompareMode: compareState.isCompareMode, allDiagramTags };
}
