import { useShallow } from "zustand/react/shallow";
import type { DiagramModel } from "../../model/diagram.types";
import { useDiagramStore } from "../diagram.store";

export const useActiveDiagramId = () => useDiagramStore((s) => s.activeDiagramId);

/** Full diagram including viewport — use on the canvas where pan/zoom must subscribe. */
export const useActiveDiagram = () =>
  useDiagramStore((s) => (s.activeDiagramId ? s.diagrams[s.activeDiagramId] : null));

/**
 * Active diagram **without** viewport in the selector result. Shallow-compares the rest,
 * so pan/zoom alone does not re-render subscribers (panels, chat, etc.).
 */
export const useActiveDiagramModel = () =>
  useDiagramStore(
    useShallow((s) => {
      const id = s.activeDiagramId;
      if (!id) return null;
      const d = s.diagrams[id];
      if (!d) return null;
      const { viewport: _viewport, ...rest } = d;
      return rest as DiagramModel;
    }),
  );

export const useDiagramIds = () => useDiagramStore(useShallow((s) => Object.keys(s.diagrams)));

export const useDiagram = (id: string) => useDiagramStore((s) => s.diagrams[id]);

export const useDiagrams = () => useDiagramStore(useShallow((s) => s.diagrams));

/**
 * Lists all diagrams for dashboards / sidebars. Shallow-compares the value array
 * so add/remove updates the UI without a React `useMemo`.
 */
export const useAllDiagrams = () => useDiagramStore(useShallow((s) => Object.values(s.diagrams)));
