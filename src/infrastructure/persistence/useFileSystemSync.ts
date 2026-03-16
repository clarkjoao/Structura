import { useEffect, useRef } from "react";
import { useDiagramStore } from "@/features/diagram";
import { fileSystemAdapter } from "./FileSystemAdapter";

export function useFileSystemSync() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsub = useDiagramStore.subscribe((state, prevState) => {
      if (!fileSystemAdapter.isConnected) return;

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        try {
          fileSystemAdapter.setFolders(state.folders);

          const prevDiagrams = prevState.diagrams;
          for (const [id, diagram] of Object.entries(state.diagrams)) {
            if (diagram !== prevDiagrams[id]) {
              await fileSystemAdapter.writeDiagram(diagram);
            }
          }

          await fileSystemAdapter.writeManifest({
            version: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            diagramIds: Object.keys(state.diagrams),
            serviceRegistry: state.serviceRegistry,
            folders: state.folders,
            activeDiagramId: state.activeDiagramId,
          });
        } catch (e) {
          console.error("[FileSystemSync] write failed:", e);
        }
      }, 800);
    });

    return () => {
      unsub();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);
}
