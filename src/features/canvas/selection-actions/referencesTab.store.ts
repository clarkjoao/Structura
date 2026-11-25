import { create } from "zustand";
import { useCanvasPreferencesStore } from "../preferences";

/**
 * A request to show an element's references (the Connections tab) in the inspector: from the toolbar's Refs
 * button, or a shared chip or badge picked on the canvas. The inspector takes it once and clears
 * it, so the tab it remembers for the type is otherwise left alone.
 */
interface ReferencesTabState {
  requestedFor: string | null;
  clear: () => void;
}

export const useReferencesTabStore = create<ReferencesTabState>((set) => ({
  requestedFor: null,
  clear: () => set({ requestedFor: null }),
}));

/** Opens the inspector, unfolded, on the tab with this element's references. */
export function requestReferencesTab(componentId: string): void {
  const preferences = useCanvasPreferencesStore.getState();
  if (preferences.elementPanelCollapsed) preferences.setElementPanelCollapsed(false);
  useReferencesTabStore.setState({ requestedFor: componentId });
}
