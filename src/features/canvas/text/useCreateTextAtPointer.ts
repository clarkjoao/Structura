import { useCallback, useEffect, useRef, type RefObject } from "react";
import { useReactFlow } from "@xyflow/react";
import { COMPONENT_TYPE_TEXT } from "@/features/diagram";
import { registryCatalog } from "../catalog/toolbarTools";
import { useCatalogInsert } from "../catalog/useCatalogInsert";

/**
 * The T key: a new, empty text where the mouse is, ready to type in. The layer
 * is shown by the insert itself.
 *
 * The pointer is tracked on the canvas as it moves, in a ref — a key press has
 * no position of its own. Before the pointer has been over the canvas (or when
 * it has left it) the text goes to the middle of the canvas instead.
 */
export function useCreateTextAtPointer(
  canvasRef: RefObject<HTMLElement | null>,
  onCreated: (nodeId: string) => void,
): () => boolean {
  const { screenToFlowPosition } = useReactFlow();
  const insert = useCatalogInsert();
  const pointer = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const track = (event: PointerEvent) => {
      pointer.current = { x: event.clientX, y: event.clientY };
    };
    const forget = () => {
      pointer.current = null;
    };
    canvas.addEventListener("pointermove", track);
    canvas.addEventListener("pointerleave", forget);
    return () => {
      canvas.removeEventListener("pointermove", track);
      canvas.removeEventListener("pointerleave", forget);
    };
  }, [canvasRef]);

  return useCallback(() => {
    const entry = registryCatalog().byId.get(COMPONENT_TYPE_TEXT);
    if (!entry) return false;
    const rect = canvasRef.current?.getBoundingClientRect();
    const at =
      pointer.current ??
      (rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null);
    if (!at) return false;
    const id = insert(entry, { position: screenToFlowPosition(at) });
    if (id) onCreated(id);
    return id !== null;
  }, [canvasRef, insert, onCreated, screenToFlowPosition]);
}
