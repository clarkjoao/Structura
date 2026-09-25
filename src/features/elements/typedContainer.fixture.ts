import { SPREAD_HANDLES } from "@/features/canvas/nodes/node-types/handle-spec";
import type { Component } from "@/features/diagram/model/component.types";
import { hasElement, registerElement, unregisterElement } from "./element.registry";
import type { ElementDescriptor } from "./element.types";

/**
 * A typed container that takes `system` children only, registered for the
 * suite. The real ones (sharded store, cluster, state machine) come with their
 * slices; this pins the contract they all go through.
 */
export const TEST_CONTAINER = "test-typed-container";
const CONTAINER = TEST_CONTAINER;

const fixture: ElementDescriptor = {
  id: CONTAINER as never,
  family: "structural",
  labelKey: "canvasToolbar.panel",
  descriptionKey: "elements.panel.description",
  model: {
    createComponent: (base) => ({ ...base, type: CONTAINER }) as unknown as Component,
    defaultSize: { width: 400, height: 300 },
    patchableKeys: [],
  },
  canvas: {
    rfType: CONTAINER,
    component: () => null,
    handles: SPREAD_HANDLES,
    role: "container",
    zIndex: -1,
    connectable: false,
    canHaveParent: true,
    canBeParent: true,
    canBeConnectionSource: true,
    derivesSize: false,
    acceptsChildren: ["system"],
    collapsible: true,
    buildData: () => ({}),
  },
  palette: {
    categoryId: "test-typed",
    icon: { kind: "family", iconName: "x" },
    accent: { kind: "neutral" },
    searchKeys: [],
    hidden: true,
  },
  inspector: {},
  export: {
    drawio: { toExportNode: (_comp, base) => ({ ...base, kind: "passthrough" }) as never },
  },
};

/** Registers the fixture container for a suite (idempotent). */
export function registerTestContainer(): void {
  if (!hasElement(CONTAINER)) registerElement(fixture);
}

export function unregisterTestContainer(): void {
  unregisterElement(CONTAINER);
}
