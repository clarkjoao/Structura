import i18n from "@/infrastructure/i18n/i18n";
import { hasElement } from "@/features/elements/element.registry";
import { generateId } from "@/features/diagram/utils/generate-id";
import type { DiagramModel } from "@/features/diagram/model/diagram.types";
import type { KindCommandContext, KindContext, KindText } from "./kind.types";

/** The context a kind reads the world through (D2): never the store. */
export function kindContextFor(
  diagram: Pick<DiagramModel, "direction" | "layoutSettings">,
): KindContext {
  return {
    t: (key, values) => i18n.t(key, values ?? {}),
    isElementRegistered: (type) => hasElement(type),
    direction: diagram.direction ?? "LR",
    layoutSettings: diagram.layoutSettings,
    newId: (prefix) => generateId(prefix),
  };
}

export function kindCommandContextFor(
  diagram: DiagramModel,
  selectedIds: readonly string[],
): KindCommandContext {
  return { ...kindContextFor(diagram), diagram, selectedIds };
}

/** Resolves a kind's display text in the active locale. */
export function resolveKindText(
  text: KindText,
  values?: Record<string, string | number>,
  locale: string = i18n.language,
): string {
  if ("key" in text) return i18n.t(text.key, values ?? {});
  const value = text.text;
  if (typeof value === "string") return value;
  return value[locale as "en" | "pt-BR"] ?? value.en ?? value["pt-BR"] ?? "";
}
