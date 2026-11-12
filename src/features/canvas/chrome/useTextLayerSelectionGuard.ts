import { useEffect } from "react";
import { isTextComponent, type Component } from "@/features/diagram";
import { useTextLayer, type TextLayer } from "../text/useTextLayer";

/**
 * The editor's text layer, with its rule for the selection: hiding the layer
 * hides what is selected in it, so a selected text is deselected (and nothing
 * is deleted).
 */
export function useTextLayerSelectionGuard(
  selectedComponent: Component | null,
  closePanel: () => void,
): TextLayer {
  const textLayer = useTextLayer();
  const selectedIsText = !!selectedComponent && isTextComponent(selectedComponent);
  useEffect(() => {
    if (!textLayer.visible && selectedIsText) closePanel();
    // closePanel is stable enough; re-running on every handler identity would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textLayer.visible, selectedIsText]);
  return textLayer;
}
