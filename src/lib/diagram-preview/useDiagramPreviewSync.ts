import { useEffect } from "react";
import { useDiagramStore } from "@/features/diagram";
import { generatePreviewSvg, type PreviewTheme } from "./generatePreviewSvg";
import { getPreview, setPreview } from "./previewCache";

/** Both variants are kept current, so switching theme never shows a stale card. */
const PREVIEW_THEMES: readonly PreviewTheme[] = ["light", "dark"];

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
        for (const theme of PREVIEW_THEMES) {
          if (!getPreview(diagram.id, theme)) {
            setPreview(diagram.id, generatePreviewSvg(diagram, theme), theme);
          }
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
          for (const theme of PREVIEW_THEMES) {
            setPreview(id, generatePreviewSvg(latest, theme), theme);
          }
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
