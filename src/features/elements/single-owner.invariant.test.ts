import { describe, expect, it } from "vitest";
import { NODE_TYPE_REGISTRY } from "@/features/canvas/nodes/node-types/registry";
import { buildComponentForType } from "@/features/diagram/store/slices/components.slice";
import { sanitizeComponentType } from "@/features/diagram";
import { buildCanvasPickerOptions } from "@/features/canvas/toolbar/element-picker/buildPickerOptions";
import { isValidNodeType } from "@/features/llm/component-catalog";
import {
  allElements,
  elementDefaultSize,
  getElement,
  registeredElementIds,
} from "./element.registry";
import { emptyNodeBuildContext } from "./node-build-context.fixture";
import { C4_TYPES } from "@/features/diagram/model/component-type-constants";
import { allCloudFamilies } from "./families/cloud-family.registry";

/**
 * A type is owned by exactly one path.
 *
 * After the family-contract close, catalog category ids are open (registered
 * via `registerCloudFamily`) and are not mirrored as type literals. Structural
 * + C4 stay as the closed mirror; cloud coverage is asserted from the family
 * registry instead.
 */

const registeredIds = registeredElementIds();

/** Closed structural + C4 ids — cloud categories are open / registry-owned. */
const FIXED_REGISTERED_IDS = [
  "person",
  "system",
  "container",
  "component",
  "json-viewer",
  "note",
  "db-table",
  "api-group",
  "endpoint",
  "panel",
  "process-node",
  "external-element",
  "vsm-external",
  "vsm-process",
  "svg",
  "unknown",
] as const;

describe("the registry and its type-level mirror agree", () => {
  it("registers every fixed structural + C4 id", () => {
    for (const id of FIXED_REGISTERED_IDS) {
      expect(registeredIds, id).toContain(id);
    }
  });

  it("registers every category of every cloud family", () => {
    for (const family of allCloudFamilies()) {
      for (const category of family.categories) {
        expect(registeredIds, category.id).toContain(category.id);
      }
    }
  });

  it("covers every C4 Model type", () => {
    expect(C4_TYPES.every((id) => registeredIds.includes(id))).toBe(true);
  });
});

describe.each(registeredIds)("%s has a single owner", (type) => {
  it("is not matched by any legacy render descriptor", () => {
    const legacyOwners = NODE_TYPE_REGISTRY.filter((descriptor) => descriptor.matches(type)).map(
      (descriptor) => descriptor.rfType,
    );

    expect(legacyOwners).toEqual([]);
  });

  it("is built from its descriptor, not from a legacy construction branch", () => {
    const descriptor = getElement(type)!;
    const built = buildComponentForType("el-1", type, "Name", null, undefined, undefined);

    const fromDescriptor = descriptor.model.createComponent(
      { id: "el-1", name: "Name", description: "", parentId: null },
      {},
    );

    expect(built.component).toEqual(fromDescriptor);
  });

  it("is not listed by the legacy canvas palette", () => {
    const legacyOptions = buildCanvasPickerOptions();
    expect(legacyOptions.map((option) => option.type)).not.toContain(type);
  });

  it("is still accepted by the type sanitizer", () => {
    expect(sanitizeComponentType(type)).toBe(type);
  });

  it("is offered to the LLM", () => {
    expect(isValidNodeType(type)).toBe(true);
  });

  it("declares everything the registry requires", () => {
    const descriptor = getElement(type)!;
    expect(descriptor.export.drawio.toExportNode).toBeTypeOf("function");
    expect(descriptor.canvas.handles).toBeDefined();
    const size = elementDefaultSize(descriptor);
    expect(size.width).toBeGreaterThan(0);
    if (size.height !== undefined) expect(size.height).toBeGreaterThan(0);
  });
});

describe("a fixed-size element paints at the size it was created at", () => {
  const fixedSized = allElements().filter((element) => !element.canvas.derivesSize);

  it("covers at least one element", () => {
    expect(fixedSized.length).toBeGreaterThan(0);
  });

  it.each(fixedSized.map((element) => element.id))("%s", (id) => {
    const element = getElement(id)!;
    const component = element.model.createComponent(
      { id: "el-1", name: "Name", description: "", parentId: null },
      {},
    );

    const style = element.canvas.buildStyle?.(component, emptyNodeBuildContext());
    if (!style) return;

    const size = elementDefaultSize(element);
    expect(style.width).toBe(size.width);
    if (size.height !== undefined) expect(style.height).toBe(size.height);
  });
});

describe("what the legacy render registry still owns", () => {
  it("holds no built-in catch-all (plugins only)", () => {
    expect(NODE_TYPE_REGISTRY.map((descriptor) => descriptor.rfType)).toEqual([]);
  });

  it("covers fixed ids plus every registered cloud family category", () => {
    const cloudCategoryCount = allCloudFamilies().reduce(
      (n, family) => n + family.categories.length,
      0,
    );
    expect(registeredIds.length).toBe(FIXED_REGISTERED_IDS.length + cloudCategoryCount);
  });
});

describe("registered elements are internally consistent", () => {
  it("agrees with its own handle spec on whether it is a source", () => {
    for (const element of allElements()) {
      expect(element.canvas.canBeConnectionSource, element.id).toBe(
        element.canvas.handles.outgoing > 0,
      );
    }
  });

  it("gives every element a distinct React Flow type", () => {
    const rfTypes = allElements().map((element) => element.canvas.rfType);
    expect(new Set(rfTypes).size).toBe(rfTypes.length);
  });
});
