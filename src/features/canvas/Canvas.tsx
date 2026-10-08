import { SharedLayer } from "./shared/SharedLayer";
import { useState } from "react";
import { Panel, Controls } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useNodeTypes } from "./nodes/node-types";
import CanvasSearch from "./toolbar/CanvasSearch";
import { CanvasBottomToolbar } from "./catalog/CanvasBottomToolbar";
import { CanvasViewOptions } from "./toolbar/components/CanvasViewOptions";
import { NothingInViewCard } from "./components/NothingInViewCard";
import { CollabPresenceLayer } from "./components/CollabPresenceLayer";
import { makeMiniMapNodeColor } from "./components/miniMapNodeColor";
import { DragThrottledMiniMap } from "./components/DragThrottledMiniMap";
import { useViewportOccupancy } from "./hooks/useViewportOccupancy";
import { useCanvasPreferencesStore } from "./preferences";
import { DiagramSidebar } from "./navigation/DiagramSidebar";
import { HandleHighlightProvider } from "./contexts/HandleHighlightContext";
import { EdgeLabelRevealProvider } from "./contexts/EdgeLabelRevealContext";
import { useRevealedLabelEdgeIds } from "./contexts/useRevealedLabelEdgeIds";
import { useCanvasController } from "./hooks/useCanvasController";
import { useCanvasInputProfile } from "./hooks/useCanvasInputProfile";
import { useSelectInsertedNodes } from "./hooks/useSelectInsertedNodes";
import { getCachedCanvasSnapshot, useDiagramStore, isTextComponent } from "@/features/diagram";
import { CANVAS_STYLES, isSnapToGridDisabledForE2E } from "./canvas.constants";
import { DRAG_THRESHOLD_PX } from "./selection/dragThreshold";
import { useEdgeReconnect } from "./edges/interaction/useEdgeReconnect";
import type { CanvasProps } from "./canvas.types";
import { DiagramSurface, writePolicy } from "./core";
import { CanvasOverlays } from "./chrome/CanvasOverlays";
import { CanvasRightRail } from "./chrome/CanvasRightRail";
import { CompareModeBanner } from "./chrome/CompareModeBanner";
import { PendingSuggestionToolbars } from "./chrome/PendingSuggestionToolbars";
import { SelectionToolbars } from "./chrome/SelectionToolbars";
import { useSelectedComponent } from "./chrome/useSelectedComponent";
import { useCanvasArrangeControl } from "./chrome/useCanvasArrangeControl";
import { useCanvasChat } from "./chrome/useCanvasChat";
import { useCanvasDropTarget } from "./chrome/useCanvasDropTarget";
import { useCanvasFocusFromUrl, useCanvasNotices } from "./chrome/useCanvasNotices";
import { useFlowModeClosesChrome } from "./chrome/useFlowModeClosesChrome";
import { useLockedNodeDrag } from "./chrome/useLockedNodeDrag";
import { useTextLayerSelectionGuard } from "./chrome/useTextLayerSelectionGuard";

/**
 * Phase 4 — selection epic.
 *
 * Selection modifiers (any of these toggle/add to multi-selection):
 *   Meta (macOS Cmd) / Control (Win/Linux Ctrl) / Shift.
 *
 * Pan modifier: holding Space + drag pans. Middle-button and right-button
 * drags also pan; the right-button path is gated by the pointer funnel —
 * short press opens the context menu, long press pans.
 *
 * Decision #8: **a right-drag pans from anywhere on the canvas**, nodes and
 * panels included. An earlier revision of this docblock declared the opposite
 * ("right-button pan is a pane gesture") and eight `it.skip`s in
 * `cypress/e2e/right-button-context-menu.cy.ts` kept that gap named; the
 * product owner revoked the rule, the tests are live, and they are the
 * acceptance criterion.
 *
 * Two mechanisms deliver it, and which one runs is decided once, at
 * pointerdown, so they can never both move the viewport for one gesture:
 *
 *   - press outside `.nopan`  →  d3-zoom pans, via `panOnDrag=[1, 2]`;
 *   - press inside `.nopan`   →  the pointer funnel pans, translating the
 *     viewport by the pointer delta through `setViewport`.
 *
 * `.react-flow__node` carries `nopan`, which is why the second branch exists.
 * The branch is owned here rather than removed at the source because
 * `noPanClassName` — the only prop that reaches React Flow's filter — is
 * global: renaming the class re-enables pan over every text field, slider and
 * quick-action bar inside a node too. React Flow itself takes the same shape,
 * hardcoding one early return for the MIDDLE button over nodes and edges in
 * `createFilter`; it just has no equivalent for the right button. See the
 * precedence docblock in `selection/pointerFunnel.ts`.
 *
 * `selectionKeyCode` is neutralised (set to `null`) so React Flow's default
 * "Shift = selection mode" does not fight our Shift-as-multi-selection
 * modifier. With the default, holding Shift would flip `selectionKeyPressed`
 * which forces `panOnDrag=false` and disables `selectionOnDrag`, breaking
 * Shift+drag-marquee.
 */

const Canvas = (props: CanvasProps = {}) => {
  useCanvasNotices();
  const nodeTypes = useNodeTypes();
  const [templateNodeId, setTemplateNodeId] = useState<string | null>(null);
  const inputProfile = useCanvasInputProfile();
  const edgeReconnect = useEdgeReconnect();
  const controller = useCanvasController(props);
  const {
    t,
    diagram,
    reactFlowWrapperRef,
    visualState,
    nodes,
    edges,
    eventHandlers,
    interactionMode,
    showSearch,
    setShowSearch,
    showDiagramSidebar,
    setShowDiagramSidebar,
    showCommandPalette,
    setShowCommandPalette,
    showVersions,
    setShowVersions,
    handleSelectDiagram,
    handleSearchSelect,
    isPanelOpen,
    selectedNodes,
    isCompareMode,
    handleAutoLayout,
    isAutoLayoutRunning,
    actions,
  } = controller;
  const drag = useLockedNodeDrag(nodes, controller.onNodeDragStop);
  const { isFlowActive } = interactionMode;
  const canEditStructure = interactionMode.canEditCanvas && !isFlowActive && !isCompareMode;
  const arrangeControl = useCanvasArrangeControl({ ...controller, diagram, canEditStructure });
  const { selectInsertedNode, selectInsertedNodes } = useSelectInsertedNodes(visualState);
  const dropTarget = useCanvasDropTarget({
    canEditCanvas: interactionMode.canEditCanvas,
    importDrawioResult: actions.importDrawioResult,
    setSelectedNodeIds: visualState.setSelectedNodeIds,
    selectInsertedNode,
  });
  const initialViewport = useDiagramStore((state) =>
    state.activeDiagramId ? state.diagrams[state.activeDiagramId]?.viewport : undefined,
  );

  useCanvasFocusFromUrl(visualState);

  const showMiniMap = useCanvasPreferencesStore((state) => state.showMiniMap);
  const occupancy = useViewportOccupancy();

  const chat = useCanvasChat(isFlowActive);
  useFlowModeClosesChrome({
    isFlowActive,
    diagramId: diagram?.id,
    showVersions,
    setShowVersions,
    showDiagramSidebar,
    setShowDiagramSidebar,
  });

  const selectedComponent = useSelectedComponent(visualState.selectedNodeId, selectedNodes.length);
  const textLayer = useTextLayerSelectionGuard(selectedComponent, eventHandlers.closePanel);

  const revealedLabelEdgeIds = useRevealedLabelEdgeIds(
    diagram ? getCachedCanvasSnapshot(diagram).connections : null,
    visualState.selectedNodeIds,
  );

  if (!diagram) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        {t("canvas.noDiagramSelected")}
      </div>
    );
  }

  const resolvedSnapshot = getCachedCanvasSnapshot(diagram);

  return (
    <HandleHighlightProvider
      value={{
        highlightedConnectionIds: visualState.highlightedConnectionIds,
        highlightedNodeIds: visualState.highlightedNodeIds,
        setHighlight: visualState.setHighlight,
        clearHighlight: visualState.clearHighlight,
      }}
    >
      <EdgeLabelRevealProvider value={revealedLabelEdgeIds}>
        <div className="flex-1 flex relative h-full min-h-0">
          <style>{CANVAS_STYLES}</style>
          <div ref={reactFlowWrapperRef} className="flex-1 relative">
            {!interactionMode.isPlaying && arrangeControl && (
              <CanvasBottomToolbar
                diagram={diagram}
                isPanelOpen={isPanelOpen}
                canInsert={canEditStructure}
                onInserted={selectInsertedNodes}
                arrange={arrangeControl}
                versions={{
                  locked: !interactionMode.canEditVersions || isFlowActive,
                  open: showVersions,
                  onOpenChange: setShowVersions,
                }}
                tags={{
                  allTags: controller.allDiagramTags,
                  visibleTags: visualState.visibleTags,
                  locked: !interactionMode.canEditVersions || isFlowActive,
                  onToggle: visualState.toggleTag,
                  onShowAll: visualState.showAllTags,
                  onShowNoTags: visualState.showNoTags,
                }}
              />
            )}
            {showSearch && diagram && (
              <CanvasSearch
                onClose={() => setShowSearch(false)}
                onSelectResult={handleSearchSelect}
                // Texts are found only while their layer is on: hidden, they are not there.
                components={
                  textLayer.visible
                    ? resolvedSnapshot.components
                    : Object.fromEntries(
                        Object.entries(resolvedSnapshot.components).filter(
                          ([, component]) => !isTextComponent(component),
                        ),
                      )
                }
              />
            )}
            <div className="absolute inset-y-0 left-0 z-30 flex">
              <DiagramSidebar
                isOpen={showDiagramSidebar && !isFlowActive}
                onClose={() => setShowDiagramSidebar(false)}
                currentDiagramId={diagram.id}
                onSelectDiagram={handleSelectDiagram}
              />
            </div>
            <div
              onContextMenu={(e) => e.preventDefault()}
              onDragOver={dropTarget.onDragOver}
              onDrop={dropTarget.onDrop}
              onDoubleClick={(event) => {
                if (interactionMode.canEditCanvas) eventHandlers.onPaneDoubleClick(event);
              }}
              className="w-full h-full"
            >
              {isCompareMode && <CompareModeBanner />}
              <DiagramSurface
                policy={writePolicy(interactionMode.canEditCanvas)}
                readingDirection={diagram.direction ?? "LR"}
                dragActivity={drag.dragActivity}
                nodes={drag.lockedNodes}
                edges={edges}
                nodeTypes={nodeTypes}
                inputProfile={inputProfile}
                snapToGrid={!isSnapToGridDisabledForE2E()}
                nodeDragThreshold={DRAG_THRESHOLD_PX}
                onNodesChange={controller.onNodesChange}
                onEdgesChange={eventHandlers.onEdgesChange}
                onConnect={eventHandlers.onConnect}
                onConnectEnd={eventHandlers.onConnectEnd}
                onReconnect={edgeReconnect.onReconnect}
                onReconnectStart={edgeReconnect.onReconnectStart}
                onReconnectEnd={edgeReconnect.onReconnectEnd}
                onNodeClick={eventHandlers.onNodeClick}
                onEdgeClick={eventHandlers.onEdgeClick}
                onNodeDoubleClick={eventHandlers.onNodeDoubleClick}
                onEdgeDoubleClick={eventHandlers.onEdgeDoubleClick}
                onPaneClick={eventHandlers.onPaneClick}
                onPaneContextMenu={eventHandlers.onPaneContextMenu}
                onNodeContextMenu={eventHandlers.onNodeContextMenu}
                onNodeDragStart={drag.onNodeDragStart}
                onNodeDragStop={drag.onNodeDragStop}
                onSelectionChange={eventHandlers.onSelectionChange}
                defaultViewport={initialViewport}
                onMoveEnd={eventHandlers.onMoveEnd}
              >
                <SharedLayer
                  suggest={interactionMode.canEditCanvas}
                  components={resolvedSnapshot.components}
                  connections={resolvedSnapshot.connections}
                  onPick={(originalId) => {
                    // A badge stands for its original: picking it is picking the original.
                    const node = nodes.find((candidate) => candidate.id === originalId);
                    if (node) eventHandlers.onNodeClick?.({} as never, node);
                  }}
                />
                <PendingSuggestionToolbars
                  selectedNodeIds={visualState.selectedNodeIds}
                  selectedNodeId={visualState.selectedNodeId}
                />
                <SelectionToolbars
                  nodeId={visualState.selectedNodeId}
                  selectedCount={selectedNodes.length}
                  component={selectedComponent}
                  canEditCanvas={interactionMode.canEditCanvas}
                  diagramId={diagram?.id ?? ""}
                  actions={actions}
                  onFocusElement={handleSearchSelect}
                />
                {/* Zoom, fit, view options and the minimap all move the viewport, and a
              reading moves it for you — every step frames its own element. Leaving
              them out keeps the two from fighting over the same viewport, and keeps
              the reading's canvas as clean as the rail beside it. Recording still
              needs them: that is where you go looking for the next element to click. */}
                {!interactionMode.isPlaying && (
                  <>
                    <Controls className="!bg-card !border-border !rounded-lg !shadow-lg [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-muted-foreground [&>button:hover]:!bg-surface-hover [&>button]:!rounded-md [&>button]:!w-8 [&>button]:!h-8" />
                    <Panel position="bottom-left" className="!mb-4 !ml-[3.25rem]">
                      <CanvasViewOptions />
                    </Panel>
                    {showMiniMap && (
                      <DragThrottledMiniMap
                        dragActivity={drag.dragActivity}
                        pannable
                        zoomable
                        position="bottom-right"
                        nodeColor={makeMiniMapNodeColor(resolvedSnapshot.components)}
                        /* Offset above the floating chat button, which also sits bottom-right. */
                        className="!mb-20 !mr-4 !bg-card !border !border-border !rounded-lg !shadow-lg"
                        maskColor="hsl(var(--muted) / 0.6)"
                      />
                    )}
                  </>
                )}
                <CollabPresenceLayer />
                {occupancy.hasNodes && !occupancy.anyNodeVisible && (
                  <NothingInViewCard elementCount={occupancy.nodeCount} />
                )}
              </DiagramSurface>
            </div>
          </div>

          <CanvasOverlays
            diagram={diagram}
            resolvedSnapshot={resolvedSnapshot}
            nodes={nodes}
            visualState={visualState}
            canEditCanvas={interactionMode.canEditCanvas}
            onAutoLayout={handleAutoLayout}
            isAutoLayoutRunning={isAutoLayoutRunning}
            onQuickInsert={eventHandlers.handleQuickInsert}
            showCommandPalette={showCommandPalette}
            onCloseCommandPalette={() => setShowCommandPalette(false)}
            onSelectDiagram={handleSelectDiagram}
            templateNodeId={templateNodeId}
            onTemplateNodeIdChange={setTemplateNodeId}
          />

          <CanvasRightRail
            focusMode={props.focusMode}
            onToggleFocusMode={props.onToggleFocusMode}
            chat={chat}
            showChat={props.showChat !== false}
            showElementPanel={controller.showElementPanel}
            visualState={visualState}
            selectedNodes={selectedNodes}
            focusTitleTrigger={controller.focusTitleTrigger}
            onFocusElement={handleSearchSelect}
            onTogglePanelCollapse={controller.handlePanelCollapseToggle}
            onClosePanel={eventHandlers.closePanel}
          />
        </div>
      </EdgeLabelRevealProvider>
    </HandleHighlightProvider>
  );
};

export default Canvas;
