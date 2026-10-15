import { useCallback } from "react";
import { useTextToolStore } from "./textLayer.store";

export interface TextLayer {
  /** The editor draws the texts. */
  visible: boolean;
  show: () => void;
  hide: () => void;
  /** The toolbar button: shows or hides the layer. */
  toggle: () => void;
}

/**
 * The editor's text layer, local to the session.
 *
 * Creating a text shows the layer first (see `useCatalogInsert`), so a text
 * never lands invisible. Whether texts reach a viewer, a link or an export is
 * another thing: the diagram's saved `textsVisible`, set where it is shared.
 */
export function useTextLayer(): TextLayer {
  const visible = useTextToolStore((state) => state.layerVisible);
  const setLayerVisible = useTextToolStore((state) => state.setLayerVisible);

  const show = useCallback(() => setLayerVisible(true), [setLayerVisible]);
  const hide = useCallback(() => setLayerVisible(false), [setLayerVisible]);
  const toggle = useCallback(() => setLayerVisible(!visible), [visible, setLayerVisible]);

  return { visible, show, hide, toggle };
}
