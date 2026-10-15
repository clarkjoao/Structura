import { useCallback } from "react";
import { useActiveDiagramId, useDiagramActions, useDiagramStore } from "@/features/diagram";
import { useTextToolStore } from "./textLayer.store";

export interface TextLayer {
  /** The diagram's text layer is on: its texts are drawn. */
  visible: boolean;
  /** The next canvas click creates a text. */
  toolActive: boolean;
  show: () => void;
  hide: () => void;
  /** Off: turns the layer on. On: arms (or disarms) the create tool. */
  pressTool: () => void;
  cancelTool: () => void;
}

/**
 * The text layer of the active diagram and its create tool.
 *
 * Hiding the layer disarms the tool and leaves every text where it is — only
 * what is drawn changes. Creating a text turns the layer on first (see
 * `useCatalogInsert`), so a text never lands invisible.
 */
export function useTextLayer(): TextLayer {
  const diagramId = useActiveDiagramId();
  const { setTextsVisible } = useDiagramActions();
  const visible = useDiagramStore((state) =>
    state.activeDiagramId ? state.diagrams[state.activeDiagramId]?.textsVisible === true : false,
  );
  const toolActive = useTextToolStore((state) => state.toolActive);
  const setToolActive = useTextToolStore((state) => state.setToolActive);

  const show = useCallback(() => {
    if (diagramId) setTextsVisible(diagramId, true);
  }, [diagramId, setTextsVisible]);

  const hide = useCallback(() => {
    setToolActive(false);
    if (diagramId) setTextsVisible(diagramId, false);
  }, [diagramId, setTextsVisible, setToolActive]);

  const pressTool = useCallback(() => {
    if (!visible) {
      show();
      return;
    }
    setToolActive(!toolActive);
  }, [visible, show, toolActive, setToolActive]);

  const cancelTool = useCallback(() => setToolActive(false), [setToolActive]);

  return { visible, toolActive, show, hide, pressTool, cancelTool };
}
