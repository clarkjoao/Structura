import { useEffect, useRef } from "react";

interface Params {
  /** True while a flow is being recorded or edited. */
  isRecording: boolean;
  /** A collaboration session puts the flows panel away and keeps it away. */
  isCollaborating: boolean;
  setShowFlows: (open: boolean) => void;
}

/**
 * The hand-off between the flows list and the panel a flow is written in.
 *
 * The two are never up together: the editing panel takes the list's place for
 * as long as the session lasts. What is new is the way back — the list is the
 * only route to another flow now that a flow's steps are not reachable from
 * inside a card, so ending a session has to put it back.
 *
 * There is nothing to remember about whether it was open. Every session starts
 * from that panel: the pencil on a flow, or the button under the list.
 */
export function useFlowPanelHandover({ isRecording, isCollaborating, setShowFlows }: Params): void {
  const sessionWasUpRef = useRef(false);

  useEffect(() => {
    if (isRecording) {
      sessionWasUpRef.current = true;
      setShowFlows(false);
      return;
    }
    if (!sessionWasUpRef.current) return;
    sessionWasUpRef.current = false;
    // A session that ends inside a collaboration ends into a workspace where
    // the flows panel is not allowed; it stays away rather than reappearing.
    if (!isCollaborating) setShowFlows(true);
  }, [isRecording, isCollaborating, setShowFlows]);
}
