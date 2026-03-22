import { useEffect } from "react";
import { useDiagramStore } from "@/features/diagram";
import { generatePreviewSvg } from "./generatePreviewSvg";
import { getPreview, setPreview } from "./previewCache";

export function useDiagramPreviewSync(): void {
  useEffect(() => {
    const initialState = useDiagramStore.getState();
    Object.values(initialState.diagrams).forEach((diagram) => {
      if (!getPreview(diagram.id)) {
        setPreview(diagram.id, generatePreviewSvg(diagram));
      }
    });

    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    const unsub = useDiagramStore.subscribe((state, prevState) => {
      const id = state.activeDiagramId;
      if (!id) return;

      const diagram = state.diagrams[id];
      const prevDiagram = prevState.diagrams[id];

      if (!diagram) return;

      if (
        diagram === prevDiagram ||
        (prevDiagram !== undefined &&
          diagram.snapshot === prevDiagram.snapshot &&
          diagram.nodeLayouts === prevDiagram.nodeLayouts)
      ) {
        return;
      }

      if (debounceTimer !== undefined) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = undefined;
        const latest = useDiagramStore.getState().diagrams[id];
        if (!latest) return;
        setPreview(id, generatePreviewSvg(latest));
      }, 1500);
    });

    return () => {
      unsub();
      if (debounceTimer !== undefined) clearTimeout(debounceTimer);
    };
  }, []);
}
