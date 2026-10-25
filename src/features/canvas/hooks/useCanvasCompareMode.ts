import { useMemo } from "react";
import type { Diagram, DiagramModel } from "@/features/diagram";
import type { CompareElementVisual } from "@/features/diagram";
import {
  isDiagramCompareMode,
  buildCompareComponentVisuals,
  buildCompareConnectionVisuals,
  modifiedComponentsOf,
  versionConflicts,
} from "@/features/diagram";

const CONFLICT_COLOR = "#f59e0b";

interface CanvasCompareModeResult {
  isCompareMode: boolean;
  compareVisualByComponentId: Record<string, CompareElementVisual> | undefined;
  compareConnectionOpacity: Record<string, number> | undefined;
  versionBadgeByComponentId: Record<string, { name: string; color: string }>;
}

export function useCanvasCompareMode(
  diagram: Diagram | DiagramModel | null | undefined,
): CanvasCompareModeResult {
  const isCompareMode = useMemo(() => isDiagramCompareMode(diagram), [diagram]);

  const compareVisualByComponentId = useMemo(() => {
    if (!diagram || !isCompareMode) return undefined;
    const a = diagram.activeVersionId!;
    const b = diagram.compareVersionId!;
    return buildCompareComponentVisuals(diagram, a, b);
  }, [diagram, isCompareMode]);

  const compareConnectionOpacity = useMemo(() => {
    if (!diagram || !isCompareMode) return undefined;
    const a = diagram.activeVersionId!;
    const b = diagram.compareVersionId!;
    const v = buildCompareConnectionVisuals(diagram, a, b);
    return Object.fromEntries(Object.entries(v).map(([id, cv]) => [id, cv.opacity]));
  }, [diagram, isCompareMode]);

  const versionBadgeByComponentId = useMemo(() => {
    if (!diagram?.activeVersionId || !diagram.versions?.[diagram.activeVersionId]) return {};
    const sc = diagram.versions[diagram.activeVersionId];
    // What the Version added carries its badge; what it changed in the base, the same badge
    // marked "~"; a changed element whose base moved on since, "⚠" in amber.
    const conflicts = new Set(versionConflicts(diagram, sc.id).map((c) => c.id));
    return Object.fromEntries([
      ...Object.keys(sc.addedComponents).map((id) => [id, { name: sc.name, color: sc.color }]),
      ...Object.keys(modifiedComponentsOf(sc)).map((id) => [
        id,
        conflicts.has(id)
          ? { name: `⚠ ${sc.name}`, color: CONFLICT_COLOR }
          : { name: `~ ${sc.name}`, color: sc.color },
      ]),
    ]);
  }, [diagram]);

  return {
    isCompareMode,
    compareVisualByComponentId,
    compareConnectionOpacity,
    versionBadgeByComponentId,
  };
}
