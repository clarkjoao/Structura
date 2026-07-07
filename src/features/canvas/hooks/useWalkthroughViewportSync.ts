import { useEffect, useMemo, useRef } from "react";
import { useReactFlow } from "@xyflow/react";
import { getCachedCanvasSnapshot, useActiveDiagram } from "@/features/diagram";
import { useWalkthroughPlayer } from "@/features/walkthroughs";
import { useWalkthroughCanvasHighlight } from "../chat/useWalkthroughCanvasHighlight";

export function useWalkthroughViewportSync(): void {
  const { fitView } = useReactFlow();
  const diagram = useActiveDiagram();
  const resolved = useMemo(() => (diagram ? getCachedCanvasSnapshot(diagram) : null), [diagram]);
  const journeyPlayer = useWalkthroughPlayer();
  const highlight = useWalkthroughCanvasHighlight();
  const isJourneyPlaying = journeyPlayer.mode.kind === "playing";
  const selectedStepId =
    journeyPlayer.mode.kind === "playing" ? journeyPlayer.mode.selectedStepId : null;

  const previousSelectedStepIdRef = useRef<string | null>(null);

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
  }, [fitView, highlight.activeNodeId, isJourneyPlaying, resolved?.components, selectedStepId]);

  useEffect(() => {
    if (!isJourneyPlaying || !selectedStepId) {
      return;
    }
    const previousSelectedStepId = previousSelectedStepIdRef.current;
    if (previousSelectedStepId === selectedStepId) {
      return;
    }
    previousSelectedStepIdRef.current = selectedStepId;

    const activeNodeId = highlight.activeNodeId;
    if (activeNodeId && resolved?.components[activeNodeId]) {
      return;
    }

    void fitView({ duration: 400, padding: 0.12 });
  }, [fitView, highlight.activeNodeId, isJourneyPlaying, resolved?.components, selectedStepId]);
}
