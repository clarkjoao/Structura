import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import type { PatternTemplate } from "@/lib/catalogs/patterns";
import { useDiagramActions, type UserTemplate } from "@/features/diagram";
import { getViewportCenter } from "../viewport-utils";

/**
 * Inserts a pattern or saved template at the center of the visible canvas and
 * hands the ids it created to `onInserted` (empty when nothing was).
 */
export function usePatternInsert(
  isPanelOpen: boolean,
  onInserted: (nodeIds: string[]) => void,
): (template: PatternTemplate | UserTemplate) => void {
  const reactFlow = useReactFlow();
  const { insertPattern } = useDiagramActions();
  return useCallback(
    (template) => {
      onInserted(insertPattern(template, getViewportCenter(reactFlow, isPanelOpen)));
    },
    [insertPattern, reactFlow, isPanelOpen, onInserted],
  );
}
