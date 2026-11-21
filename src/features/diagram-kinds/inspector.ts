import type { DiagramModel } from "@/features/diagram/model/diagram.types";
import { kindCommandContextFor } from "./context";
import type { KindInspectorField, KindInspectorSection, KindText } from "./kind.types";
import { isKindActive, resolveKindPolicy } from "./policy";

/** The kind's inspector tab for one element, as the host draws it. */
export interface ResolvedKindInspector {
  tab: KindText;
  hiddenFields: ReadonlySet<KindInspectorField>;
  sections: KindInspectorSection[];
}

/**
 * The active kind's inspector tab for `elementId` (spec guided-editing-surfaces):
 * only in kind mode, and only for elements the kind's tab applies to.
 */
export function kindInspectorFor(
  diagram: DiagramModel | null | undefined,
  elementId: string,
): ResolvedKindInspector | null {
  const policy = resolveKindPolicy(diagram);
  if (!diagram || !isKindActive(policy)) return null;
  const inspector = policy.descriptor.inspector;
  if (!inspector) return null;
  const sections = inspector.sections(kindCommandContextFor(diagram, [elementId]), elementId);
  if (!sections) return null;
  return { tab: inspector.tab, hiddenFields: new Set(inspector.hiddenFields), sections };
}
