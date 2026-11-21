import type { CatalogEntry, CatalogIndex } from "@/features/elements/search";
import { resolveKindText } from "@/features/diagram-kinds/context";
import type { KindPolicyInput } from "@/features/diagram-kinds/kind.types";
import { isKindActive, resolveKindPolicy } from "@/features/diagram-kinds/policy";
import { useDiagramStore } from "@/features/diagram/store/diagram.store";

/** A kind's element as an insert surface offers it: the catalog entry, under the kind's name. */
export interface KindCatalogEntry {
  entry: CatalogEntry;
  primary: boolean;
}

/** The elements the active kind offers, in its order, with the kind's name for them. */
export interface KindCatalog {
  label: string;
  entries: KindCatalogEntry[];
}

/**
 * The active kind's elements as catalog entries (spec guided-editing-surfaces):
 * what the quick insert lists first and the toolbar offers as buttons. Null
 * outside kind mode, or for a kind that offers the whole palette.
 */
export function kindCatalogFor(
  diagram: KindPolicyInput | null | undefined,
  index: Pick<CatalogIndex, "entries">,
): KindCatalog | null {
  const policy = resolveKindPolicy(diagram);
  if (!isKindActive(policy) || policy.descriptor.elements.length === 0) return null;
  const entries: KindCatalogEntry[] = [];
  for (const ref of policy.descriptor.elements) {
    const entry = index.entries.find(
      (candidate) =>
        candidate.insert.kind === "element" &&
        candidate.insert.type === ref.type &&
        (ref.flowShape === undefined || candidate.insert.createOptions.flowShape === ref.flowShape),
    );
    if (!entry) continue;
    entries.push({
      entry: ref.label ? { ...entry, label: resolveKindText(ref.label) } : entry,
      primary: ref.primary === true,
    });
  }
  return { label: resolveKindText(policy.descriptor.label), entries };
}

/** The active diagram's kind id while in kind mode, else "": a memo key for insert surfaces. */
export function useActiveKindKey(): string {
  return useDiagramStore((state) => {
    const d = state.activeDiagramId ? state.diagrams[state.activeDiagramId] : undefined;
    const policy = resolveKindPolicy(d);
    return isKindActive(policy) ? policy.descriptor.id : "";
  });
}
