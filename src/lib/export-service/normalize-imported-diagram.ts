import type { Diagram, IconDefinition } from "@/features/diagram";
import { useIconStore } from "@/features/icons";

function normalizeOneIconEntry(key: string, value: unknown): IconDefinition | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as Record<string, unknown>;
  const id = typeof entry.id === "string" && entry.id.length > 0 ? entry.id : key;
  const name = typeof entry.name === "string" ? entry.name : id;
  const createdAt =
    typeof entry.createdAt === "number" && Number.isFinite(entry.createdAt)
      ? entry.createdAt
      : Date.now();
  const usageCount =
    typeof entry.usageCount === "number" &&
    entry.usageCount >= 0 &&
    Number.isFinite(entry.usageCount)
      ? entry.usageCount
      : 0;

  const sourceRaw = entry.source;
  if (sourceRaw && typeof sourceRaw === "object") {
    const src = sourceRaw as Record<string, unknown>;
    if (src.kind === "svg" && typeof src.svgContent === "string" && src.svgContent.length > 0) {
      return {
        id,
        name,
        createdAt,
        usageCount,
        source: { kind: "svg", svgContent: src.svgContent },
      };
    }
    if (
      src.kind === "lucide" &&
      typeof src.iconName === "string" &&
      src.iconName.trim().length > 0
    ) {
      return {
        id,
        name,
        createdAt,
        usageCount,
        source: { kind: "lucide", iconName: src.iconName.trim() },
      };
    }
    if (
      src.kind === "aws" &&
      typeof src.serviceName === "string" &&
      src.serviceName.trim().length > 0
    ) {
      return {
        id,
        name,
        createdAt,
        usageCount,
        source: { kind: "aws", serviceName: src.serviceName.trim() },
      };
    }
    return null;
  }

  if (typeof entry.svgContent === "string" && entry.svgContent.length > 0) {
    return {
      id,
      name,
      createdAt,
      usageCount,
      source: { kind: "svg", svgContent: entry.svgContent },
    };
  }

  return null;
}

function sanitizeIconLibrary(raw: unknown): Record<string, IconDefinition> {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const next: Record<string, IconDefinition> = {};
  for (const [key, value] of Object.entries(raw)) {
    const icon = normalizeOneIconEntry(key, value);
    if (icon) {
      next[icon.id] = icon;
    }
  }
  return next;
}

/**
 * Ensures imported diagram JSON has optional `customIconId` on components.
 * Sanitized embedded `snapshot.iconLibrary` entries are merged into the global icon store when missing there,
 * then cleared from the snapshot (`{}`) for schema compatibility.
 */
export function normalizeImportedDiagram(diagram: Diagram): Diagram {
  const snapshot = diagram.snapshot ?? { components: {}, connections: {}, flows: {}, iconLibrary: {} };
  const iconLibrary = sanitizeIconLibrary(snapshot.iconLibrary);

  try {
    if (Object.keys(iconLibrary).length > 0) {
      for (const [id, icon] of Object.entries(iconLibrary)) {
        const globalIcons = useIconStore.getState().icons;
        if (!globalIcons[id]) {
          useIconStore.getState().addIcon(icon);
        }
      }
    }
  } catch {
    // Icon store unavailable (e.g. unusual init order) — still return normalized diagram.
  }

  const components = { ...snapshot.components };
  for (const key of Object.keys(components)) {
    const comp = components[key];
    if (comp && !("customIconId" in comp)) {
      components[key] = { ...comp, customIconId: undefined };
    }
  }
  return {
    ...diagram,
    edgeLayouts: Array.isArray(diagram.edgeLayouts) ? diagram.edgeLayouts : [],
    snapshot: {
      ...snapshot,
      iconLibrary: {},
      components,
    },
  };
}
