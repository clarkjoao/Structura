import { useMemo } from "react";
import { useAllUserTemplates } from "@/features/diagram";
import { searchPatterns } from "./patternSearch";

/** Patterns and saved templates matching `query`: the count the catalog's chip shows. */
export function usePatternMatchCount(query: string): number {
  const userTemplates = useAllUserTemplates();
  return useMemo(() => searchPatterns(query, userTemplates).counts.all, [query, userTemplates]);
}
