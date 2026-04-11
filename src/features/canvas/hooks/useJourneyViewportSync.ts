import { useEffect, useMemo } from "react";
import { useReactFlow } from "@xyflow/react";
import { getCachedCanvasSnapshot, useActiveDiagram } from "@/features/diagram";
import { useJourneyPlayer } from "@/features/journeys";
import { useJourneyCanvasHighlight } from "../chat/useJourneyCanvasHighlight";


export function useJourneyViewportSync(): void {
  const { fitView } = useReactFlow();
  const diagram = useActiveDiagram();
  const resolved = useMemo(
    () => (diagram ? getCachedCanvasSnapshot(diagram) : null),
    [diagram],
  );
  const journeyPlayer = useJourneyPlayer();
  const highlight = useJourneyCanvasHighlight();
  const isJourneyPlaying = journeyPlayer.mode.kind === "playing";
  const selectedStepId =
    journeyPlayer.mode.kind === "playing"
      ? journeyPlayer.mode.selectedStepId
      : null;

  useEffect(() => {
    if (!isJourneyPlaying || !selectedStepId) {
      return;
    }
    const nodeId = highlight.activeNodeId;
    if (!nodeId || !resolved?.components[nodeId]) {
      return;
    }

    void fitView({
      nodes: [{ id: nodeId }],
      duration: 400,
      padding: 0.3,
    });
  }, [
    fitView,
    highlight.activeNodeId,
    isJourneyPlaying,
    resolved?.components,
    selectedStepId,
  ]);
}
