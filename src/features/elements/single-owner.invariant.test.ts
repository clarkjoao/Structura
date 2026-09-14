import { describe, expect, it } from "vitest";
import { NODE_TYPE_REGISTRY } from "@/features/canvas/nodes/node-types/registry";
import { c4Descriptor } from "@/features/canvas/nodes/node-types/c4.descriptor";
import { buildComponentForType } from "@/features/diagram/store/slices/components.slice";
import { BUILTIN_COMPONENT_TYPES, sanitizeComponentType } from "@/features/diagram";
import { buildCanvasPickerOptions } from "@/features/canvas/toolbar/element-picker/buildPickerOptions";
import { isValidNodeType } from "@/features/llm/component-catalog";
import { allElements, getElement, registeredElementIds } from "./element.registry";
import type { RegisteredElementTypeId } from "./element.types";

/**
 * A type is owned by exactly one path.
 *
 * The migration moves elements onto the registry one slice at a time, and the
 * way transition bugs get in is a type answered by both paths at once: the new
 * descriptor builds it while a legacy branch still lists it, and which one wins
 * depends on the order a chain happens to run in.
 *
 * So every check here is parameterised over whatever is registered. Migrating
 * the next type means adding it to the registry and deleting its legacy branch;
 * this file then covers it with no edit. If it does need an edit, the migration
 * left two owners behind.
 */

const registeredIds = registeredElementIds();

/** The ids the type-level mirror claims, as runtime values. */
const DECLARED_IDS: RegisteredElementTypeId[] = ["json-viewer", "note", "db-table"];

describe("the registry and its type-level mirror agree", () => {
  it("registers exactly the ids RegisteredElementTypeId names", () => {
    // The narrowing predicate is a promise that these two lists match; the
    // legacy chains drop their `never` coverage for an id on the strength of it.
    expect([...registeredIds].sort()).toEqual([...DECLARED_IDS].sort());
  });
});

describe.each(registeredIds)("%s has a single owner", (type) => {
  it("is not matched by any legacy render descriptor", () => {
    const legacyOwners = NODE_TYPE_REGISTRY.filter(
      (descriptor) => descriptor !== c4Descriptor && descriptor.matches(type),
    ).map((descriptor) => descriptor.rfType);

    expect(legacyOwners).toEqual([]);
  });

  it("is built from its descriptor, not from a legacy construction branch", () => {
    const descriptor = getElement(type)!;
    const built = buildComponentForType("el-1", type, "Name", null, undefined, undefined);

    const fromDescriptor = descriptor.model.createComponent({
      id: "el-1",
      name: "Name",
      description: "",
      parentId: null,
    });

    expect(built.component).toEqual(fromDescriptor);
    expect(built.resolvedPanelKind).toBeUndefined();
  });

  it("is not listed by the legacy canvas palette", () => {
    const legacyOptions = buildCanvasPickerOptions((key) => key);
    expect(legacyOptions.map((option) => option.type)).not.toContain(type);
  });

  it("is still accepted by the type sanitizer", () => {
    // BUILTIN_COMPONENT_TYPES stays the floor until the registry becomes the
    // only source of truth; until then both answers must agree.
    expect(sanitizeComponentType(type)).toBe(type);
    expect(BUILTIN_COMPONENT_TYPES.has(type)).toBe(true);
  });

  it("is offered to the LLM", () => {
    expect(isValidNodeType(type)).toBe(true);
  });

  it("declares everything the registry requires", () => {
    const descriptor = getElement(type)!;
    expect(descriptor.export.drawio.toExportNode).toBeTypeOf("function");
    expect(descriptor.canvas.handles).toBeDefined();
    expect(descriptor.model.defaultSize.width).toBeGreaterThan(0);
    expect(descriptor.model.defaultSize.height).toBeGreaterThan(0);
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
