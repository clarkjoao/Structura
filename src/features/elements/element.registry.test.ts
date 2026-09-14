import { afterEach, describe, expect, it } from "vitest";
import { SINGLE_PAIR_HANDLES } from "@/features/canvas/nodes/node-types/handle-spec";
import type { Component } from "@/features/diagram";
import {
  allElements,
  getElement,
  hasElement,
  registerElement,
  unregisterElement,
} from "./element.registry";
import type { ElementDescriptor, ExportGeometry } from "./element.types";

const FIXTURE_ID = "note";

function makeDescriptor(overrides: Partial<ElementDescriptor> = {}): ElementDescriptor {
  return {
    id: FIXTURE_ID,
    family: "structural",
    labelKey: "nodeTypes.json-viewer",
    descriptionKey: "elements.json-viewer.description",
    model: {
      createComponent: (base) => ({ ...base, type: "note" }),
      defaultSize: { width: 10, height: 10 },
      patchableKeys: [],
    },
    canvas: {
      rfType: "fixture",
      component: () => null,
      handles: SINGLE_PAIR_HANDLES,
      role: "custom-shape",
      zIndex: 1,
      connectable: true,
      canHaveParent: true,
      canBeParent: false,
      canBeConnectionSource: true,
      derivesSizeFromContent: false,
      buildData: () => ({}),
    },
    palette: {
      categoryId: "canvas",
      icon: { kind: "family", iconName: "fixture" },
      accent: { kind: "neutral" },
      searchKeys: [],
    },
    inspector: {},
    export: {
      drawio: {
        kind: "note",
        toExportNode: (comp: Component, base: ExportGeometry) => ({
          ...base,
          kind: "note" as const,
          name: comp.name,
          description: comp.description,
        }),
      },
    },
    ...overrides,
  };
}

afterEach(() => {
  unregisterElement(FIXTURE_ID);
});

describe("registerElement", () => {
  it("registers a valid descriptor and exposes it by id", () => {
    const descriptor = makeDescriptor();
    registerElement(descriptor);

    expect(hasElement(FIXTURE_ID)).toBe(true);
    expect(getElement(FIXTURE_ID)).toBe(descriptor);
    expect(allElements()).toContain(descriptor);
  });

  it("refuses a duplicate id", () => {
    registerElement(makeDescriptor());
    expect(() => registerElement(makeDescriptor())).toThrow(/already registered/);
  });

  it("refuses a descriptor with no draw.io mapping", () => {
    // Decision 6: every element declares how it leaves Structura. The cast is
    // the only way to build the invalid shape the guard exists to reject.
    const invalid = makeDescriptor();
    const withoutExport = { ...invalid, export: { drawio: undefined } } as unknown;

    expect(() => registerElement(withoutExport as ElementDescriptor)).toThrow(
      /export\.drawio is required/,
    );
    expect(hasElement(FIXTURE_ID)).toBe(false);
  });

  it("refuses a descriptor with no handle spec", () => {
    const invalid = makeDescriptor();
    const withoutHandles = {
      ...invalid,
      canvas: { ...invalid.canvas, handles: undefined },
    } as unknown;

    expect(() => registerElement(withoutHandles as ElementDescriptor)).toThrow(
      /canvas\.handles is required/,
    );
  });

  it("refuses a label key that is missing from a locale", () => {
    expect(() => registerElement(makeDescriptor({ labelKey: "nodeTypes.does-not-exist" }))).toThrow(
      /labelKey .* has no entry in locale\(s\): en, pt-BR/,
    );
  });

  it("refuses a description key that is missing from a locale", () => {
    expect(() =>
      registerElement(makeDescriptor({ descriptionKey: "elements.nope.description" })),
    ).toThrow(/descriptionKey .* has no entry in locale\(s\)/);
  });

  it("refuses a key that resolves to an object rather than a string", () => {
    // "elements.json-viewer" is a namespace, not a translatable string.
    expect(() => registerElement(makeDescriptor({ labelKey: "elements.json-viewer" }))).toThrow(
      /labelKey .* has no entry/,
    );
  });
});
