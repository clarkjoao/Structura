import { useSyncExternalStore } from "react";
import { overlayRegistry } from "../overlay-registry";
import { PluginModal } from "./PluginModal";

export function ModalOverlay() {
  const state = useSyncExternalStore(
    (listener) => overlayRegistry.subscribe(listener),
    () => overlayRegistry.getState(),
  );

  if (!state.activeModal) {
    return null;
  }

  const { title, content, size } = state.activeModal;

  return <PluginModal title={title} content={content} size={size} />;
}
