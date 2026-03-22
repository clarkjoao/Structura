import type { Diagram, IconDefinition } from "@/features/diagram";

function isValidIconLibraryEntry(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    entry.id.length > 0 &&
    typeof entry.name === "string" &&
    typeof entry.svgContent === "string" &&
    entry.svgContent.length > 0
  );
}

function sanitizeIconLibrary(raw: unknown): Record<string, IconDefinition> {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const next: Record<string, IconDefinition> = {};
  for (const value of Object.values(raw)) {
    if (!isValidIconLibraryEntry(value)) continue;
    const createdAt =
      typeof value.createdAt === "number" && Number.isFinite(value.createdAt)
        ? value.createdAt
        : Date.now();
    const usageCount =
      typeof value.usageCount === "number" &&
      value.usageCount >= 0 &&
      Number.isFinite(value.usageCount)
        ? value.usageCount
        : 0;
    const icon: IconDefinition = {
      id: value.id,
      name: value.name,
      svgContent: value.svgContent,
      createdAt,
      usageCount,
    };
    next[icon.id] = icon;
  }
  return next;
}

/**
 * Ensures imported diagram JSON has a valid `snapshot.iconLibrary` and optional `customIconId` on components.
 * Invalid icon entries are dropped (no throw).
 */
export function normalizeImportedDiagram(diagram: Diagram): Diagram {
  const iconLibrary = sanitizeIconLibrary(diagram.snapshot.iconLibrary);
  const components = { ...diagram.snapshot.components };
  for (const key of Object.keys(components)) {
    const comp = components[key];
    if (comp && !("customIconId" in comp)) {
      components[key] = { ...comp, customIconId: undefined };
    }
  }
  return {
    ...diagram,
    snapshot: {
      ...diagram.snapshot,
      iconLibrary,
      components,
    },
  };
}
