import { useComponent, type Component } from "@/features/diagram";
import { getElement } from "@/features/elements/element.registry";
import { FLOW_DEFAULT_ACCENT } from "./ProcessNode/flowAppearance";
import { laneAccentOf } from "./laneAccent";

/**
 * The accent a skinned node shows when it stores none: its lane's, if the
 * lane passes one on, else the element's own default.
 *
 * The accent controls (toolbar and inspector) have to use this, not the
 * element's default alone: inside a teal lane an unset node is drawn teal, so
 * picking teal must store nothing and picking slate must store slate.
 */
export function useEffectiveDefaultAccent(component: Component | null | undefined): string {
  const parent = useComponent(component?.parentId ?? "");
  if (!component) return FLOW_DEFAULT_ACCENT;
  return (
    laneAccentOf(component, parent) ??
    getElement(component.type)?.skin?.defaultAccent ??
    FLOW_DEFAULT_ACCENT
  );
}
