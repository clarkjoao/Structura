import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import type { PatternTemplate } from "@/lib/catalogs/patterns";
import { useDiagramActions, type UserTemplate } from "@/features/diagram";
import {
  NEUTRAL_PROVIDER,
  resolvePattern,
  type PatternProvider,
} from "@/features/elements/patterns";
import { getViewportCenter } from "../viewport-utils";

/**
 * Inserts a pattern or saved template at the center of the visible canvas and
 * hands the ids it created to `onInserted` (empty when nothing was).
 */
export function usePatternInsert(
  isPanelOpen: boolean,
  onInserted: (nodeIds: string[]) => void,
  provider: PatternProvider = NEUTRAL_PROVIDER,
): (template: PatternTemplate | UserTemplate) => void {
  const reactFlow = useReactFlow();
  const { insertPattern } = useDiagramActions();
  return useCallback(
    (template) => {
      // A saved template is inserted as saved; a built-in one is made concrete first.
      const insertable = "createdAt" in template ? template : resolvePattern(template, provider);
      onInserted(insertPattern(insertable, getViewportCenter(reactFlow, isPanelOpen)));
    },
    [insertPattern, reactFlow, isPanelOpen, onInserted, provider],
  );
}
