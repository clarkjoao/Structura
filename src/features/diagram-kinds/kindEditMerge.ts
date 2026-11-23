import type { Component } from "@/features/diagram/model/component.types";
import type { JsonObject } from "@/features/diagram/model/diagram-kind";
import type { KindEdit, KindNodeInput } from "@/features/diagram/model/kind-edit.types";
import type { KindTextChange } from "./kind.types";

/**
 * Merges the parts of an edit: lists are joined, an add or an update named twice
 * is one, and the kind data a part changes is applied key by key on the element's
 * own, so a score and a phase changed apart still land together.
 */
export function mergeKindEdits(
  components: Readonly<Record<string, Component>>,
  parts: readonly KindEdit[],
): KindEdit {
  const add = new Map<string, KindNodeInput>();
  const update = new Map<string, NonNullable<KindEdit["update"]>[number]>();
  const kindProps = new Map<string, JsonObject>();
  let kindData: JsonObject | undefined;
  const out: Required<
    Pick<KindEdit, "remove" | "disconnect" | "connect" | "reparent" | "relabel">
  > = { remove: [], disconnect: [], connect: [], reparent: [], relabel: [] };
  for (const part of parts) {
    for (const node of part.add ?? []) add.set(node.key, node);
    for (const entry of part.update ?? []) {
      const { kindProps: props, ...fields } = entry;
      update.set(entry.id, { ...update.get(entry.id), ...fields });
      if (props === undefined) continue;
      const own = components[entry.id]?.kindProps ?? {};
      const next = kindProps.get(entry.id) ?? { ...own };
      const changed = props ?? {};
      for (const key of new Set([...Object.keys(own), ...Object.keys(changed)])) {
        if (JSON.stringify(own[key]) === JSON.stringify(changed[key])) continue;
        if (changed[key] === undefined) delete next[key];
        else next[key] = changed[key]!;
      }
      kindProps.set(entry.id, next);
    }
    out.remove.push(...(part.remove ?? []));
    out.disconnect.push(...(part.disconnect ?? []));
    out.connect.push(...(part.connect ?? []));
    out.reparent.push(...(part.reparent ?? []));
    out.relabel.push(...(part.relabel ?? []));
    if (part.kindData) kindData = part.kindData;
  }
  for (const [id, props] of kindProps)
    update.set(id, { ...update.get(id), id, kindProps: Object.keys(props).length ? props : null });
  const edit: KindEdit = kindData ? { kindData } : {};
  if (add.size) edit.add = [...add.values()];
  if (update.size) edit.update = [...update.values()];
  for (const field of ["remove", "disconnect", "connect", "reparent", "relabel"] as const)
    if (out[field].length) (edit as Record<string, unknown>)[field] = out[field];
  return edit;
}

/** The part of a reconciled edit made of the changes `keys` names (spec guided-assistant-revisions). */
export function editForChanges(
  components: Readonly<Record<string, Component>>,
  changes: readonly KindTextChange[],
  keys: ReadonlySet<string>,
): KindEdit {
  return mergeKindEdits(
    components,
    changes.filter((change) => keys.has(change.key)).map((change) => change.edit),
  );
}
