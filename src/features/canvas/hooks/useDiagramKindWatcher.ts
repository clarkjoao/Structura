import { useEffect, useRef } from "react";
import { useReactFlow } from "@xyflow/react";
import { useDiagramStore } from "@/features/diagram";
import { kindContextFor } from "@/features/diagram-kinds/context";
import { measuredSizesOf } from "../layout/applyLayout";
import { kindLayoutServices } from "../layout/kindLayoutServices";
import { watchDiagramKind } from "./kindWatcher";

/**
 * Runs the active diagram's kind (ADR-0014) on the editor canvas while
 * `enabled`: after an edit, the kind's derivation and arrangement, written
 * without history (`watchDiagramKind`). Positions use the sizes React Flow
 * measured.
 */
export function useDiagramKindWatcher({ enabled }: { enabled: boolean }): void {
  const { getNodes } = useReactFlow();
  const enabledRef = useRef(enabled);
  const getNodesRef = useRef(getNodes);
  enabledRef.current = enabled;
  getNodesRef.current = getNodes;

  useEffect(
    () =>
      watchDiagramKind({
        store: useDiagramStore,
        isEnabled: () => enabledRef.current,
        derive: (diagram, descriptor) =>
          descriptor.derive?.(diagram, kindContextFor(diagram)) ?? null,
        arrange: async (diagram, descriptor) => {
          if (!descriptor.arrange) return;
          const measured = Object.fromEntries(measuredSizesOf(getNodesRef.current()));
          const { layouts } = await descriptor.arrange(
            diagram,
            kindContextFor(diagram),
            kindLayoutServices(diagram.layoutSettings, measured),
          );
          const store = useDiagramStore.getState();
          if (layouts.length === 0 || store.activeDiagramId !== diagram.id) return;
          store.applyAutoLayout(layouts, undefined, { history: false });
        },
      }),
    [],
  );
}
