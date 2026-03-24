import { useCallback } from "react";
import type { WebrtcProvider } from "y-webrtc";

export function useCollabAwareness(provider: WebrtcProvider | null) {
  const updateCursor = useCallback(
    (cursor: { x: number; y: number } | null) => {
      if (!provider) return;
      const previousState = provider.awareness.getLocalState() ?? {};
      provider.awareness.setLocalState({ ...previousState, cursor });
    },
    [provider],
  );

  const updateSelectedNode = useCallback(
    (selectedNodeId: string | null) => {
      if (!provider) return;
      const previousState = provider.awareness.getLocalState() ?? {};
      provider.awareness.setLocalState({ ...previousState, selectedNodeId });
    },
    [provider],
  );

  const updateViewport = useCallback(
    (viewport: { x: number; y: number; zoom: number }) => {
      if (!provider) return;
      const previousState = provider.awareness.getLocalState() ?? {};
      provider.awareness.setLocalState({ ...previousState, viewport });
    },
    [provider],
  );

  const updateEditingComponent = useCallback(
    (componentId: string | null) => {
      if (!provider) return;
      const previousState = provider.awareness.getLocalState() ?? {};
      provider.awareness.setLocalState({ ...previousState, editingComponentId: componentId });
    },
    [provider],
  );

  return { updateCursor, updateSelectedNode, updateViewport, updateEditingComponent };
}
