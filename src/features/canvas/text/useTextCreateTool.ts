import { useCallback, useEffect } from "react";
import { useReactFlow } from "@xyflow/react";
import { KEY, keyIs } from "@/lib/core/keyboard";
import { COMPONENT_TYPE_TEXT } from "@/features/diagram";
import { registryCatalog } from "../catalog/toolbarTools";
import { useCatalogInsert } from "../catalog/useCatalogInsert";
import { useTextToolStore } from "./textLayer.store";

/**
 * The text tool's click: while it is armed, a click on the empty canvas creates
 * an empty text there — which opens for typing by itself — and disarms the
 * tool. Escape disarms it too.
 *
 * Returns the pane click to put in front of the canvas's own: `true` means the
 * tool took the click, so the canvas must not also clear the selection.
 */
export function useTextCreateTool(
  canEdit: boolean,
  onCreated: (nodeId: string) => void,
): (event: { clientX: number; clientY: number }) => boolean {
  const { screenToFlowPosition } = useReactFlow();
  const insert = useCatalogInsert();
  const toolActive = useTextToolStore((state) => state.toolActive);
  const setToolActive = useTextToolStore((state) => state.setToolActive);

  useEffect(() => {
    if (!toolActive) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (keyIs(event, KEY.ESCAPE)) setToolActive(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toolActive, setToolActive]);

  // The tool is for editing: a surface that cannot edit never keeps it armed.
  useEffect(() => {
    if (!canEdit && toolActive) setToolActive(false);
  }, [canEdit, toolActive, setToolActive]);

  return useCallback(
    (event) => {
      if (!useTextToolStore.getState().toolActive || !canEdit) return false;
      const entry = registryCatalog().byId.get(COMPONENT_TYPE_TEXT);
      setToolActive(false);
      if (!entry) return true;
      const id = insert(entry, {
        position: screenToFlowPosition({ x: event.clientX, y: event.clientY }),
      });
      if (id) onCreated(id);
      return true;
    },
    [canEdit, insert, onCreated, screenToFlowPosition, setToolActive],
  );
}
