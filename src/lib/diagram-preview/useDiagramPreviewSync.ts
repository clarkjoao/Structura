import { useEffect } from "react";
import { useDiagramStore } from "@/features/diagram";
import { generatePreviewSvg } from "./generatePreviewSvg";
import { getPreview, setPreview } from "./previewCache";

function schedulePreviewSvgWork(run: () => void): () => void {
  const globalWithIdle = globalThis as typeof globalThis & {
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
    cancelIdleCallback?: (handle: number) => void;
  };
  if (typeof globalWithIdle.requestIdleCallback === "function") {
    const handle = globalWithIdle.requestIdleCallback(
      () => {
        run();
      },
      { timeout: 2500 },
    );
    return () => {
      if (typeof globalWithIdle.cancelIdleCallback === "function") {
        globalWithIdle.cancelIdleCallback(handle);
      }
    };
  }
  const timeoutId = setTimeout(run, 0);
  return () => {
    clearTimeout(timeoutId);
  };
}

export function useDiagramPreviewSync(): void {
  useEffect(() => {
    const initialState = useDiagramStore.getState();
    const cancelInitial = schedulePreviewSvgWork(() => {
      Object.values(initialState.diagrams).forEach((diagram) => {
        if (!getPreview(diagram.id)) {
          setPreview(diagram.id, generatePreviewSvg(diagram));
        }
      });
    });

    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    let cancelIdle: (() => void) | undefined;

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
      if (cancelIdle !== undefined) {
        cancelIdle();
        cancelIdle = undefined;
      }
      debounceTimer = setTimeout(() => {
        debounceTimer = undefined;
        cancelIdle = schedulePreviewSvgWork(() => {
          cancelIdle = undefined;
          const latest = useDiagramStore.getState().diagrams[id];
          if (!latest) return;
          setPreview(id, generatePreviewSvg(latest));
        });
      }, 1500);
    });

    return () => {
      cancelInitial();
      unsub();
      if (debounceTimer !== undefined) clearTimeout(debounceTimer);
      if (cancelIdle !== undefined) cancelIdle();
    };
  }, []);
}
