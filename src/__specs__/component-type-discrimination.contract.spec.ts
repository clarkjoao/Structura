/**
 * Contract: component type discrimination uses type guards, never string
 * comparison against `.type` (CLAUDE.md invariant + structura-typescript rule),
 * and `resolveNodeDescriptor` honours the swimlane panelKind guard branch.
 */
import { describe, expect, it } from "vitest";
import {
  isPanelComponent,
  isNoteComponent,
  isC4Component,
  PanelKind,
  type C4Component,
  type Component,
  type PanelComponent,
} from "@/features/diagram";
import { resolveNodeDescriptor } from "@/features/canvas/nodes/node-types";

const panel: PanelComponent = {
  id: "panel-1",
  name: "Panel",
  description: "",
  parentId: null,
  type: "panel",
};

const swimlane: PanelComponent = {
  ...panel,
  id: "swimlane-1",
  panelKind: PanelKind.Swimlane,
};

const c4: C4Component = {
  id: "c4-1",
  name: "Service",
  description: "",
  parentId: null,
  type: "container",
};

describe("component type discrimination contract", () => {
  it("narrows components with guards rather than string equality", () => {
    expect(isPanelComponent(panel)).toBe(true);
    expect(isC4Component(panel)).toBe(false);

    expect(isC4Component(c4)).toBe(true);
    expect(isPanelComponent(c4)).toBe(false);
  });

  it("keeps structural guards mutually exclusive", () => {
    const guards = [isPanelComponent, isNoteComponent, isC4Component];
    const components: Component[] = [panel, c4];
    for (const component of components) {
      const matched = guards.filter((guard) => guard(component));
      expect(matched).toHaveLength(1);
    }
  });

  it("resolveNodeDescriptor honours the swimlane panelKind guard", () => {
    expect(resolveNodeDescriptor(panel).rfType).toBe("panel");
    expect(resolveNodeDescriptor(swimlane).rfType).toBe("swimlane");
    expect(resolveNodeDescriptor(c4).rfType).toBe("c4");
  });
});
