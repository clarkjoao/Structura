import { describe, expect, it } from "vitest";
import { NODE_TYPE_REGISTRY } from "@/features/canvas/nodes/node-types/registry";
import { c4Descriptor } from "@/features/canvas/nodes/node-types/c4.descriptor";
import { buildComponentForType } from "@/features/diagram/store/slices/components.slice";
import { BUILTIN_COMPONENT_TYPES, sanitizeComponentType } from "@/features/diagram";
import { buildCanvasPickerOptions } from "@/features/canvas/toolbar/element-picker/buildPickerOptions";
import { isValidNodeType } from "@/features/llm/component-catalog";
import {
  allElements,
  elementDefaultSize,
  getElement,
  registeredElementIds,
} from "./element.registry";
import { emptyNodeBuildContext } from "./node-build-context.fixture";
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
const DECLARED_IDS: RegisteredElementTypeId[] = [
  "json-viewer",
  "note",
  "db-table",
  "api-group",
  "endpoint",
  "panel",
  "process-node",
  "external-element",
  "svg",
  "unknown",
  "gcp-compute",
  "gcp-storage",
  "gcp-database",
  "gcp-networking",
  "gcp-security",
  "gcp-analytics",
  "gcp-ai",
  "gcp-devtools",
  "gcp-integration",
  "gcp-management",
  "gcp-media",
  "gcp-general",
  "azure-compute",
  "azure-storage",
  "azure-database",
  "azure-networking",
  "azure-security",
  "azure-analytics",
  "azure-ai",
  "azure-integration",
  "azure-devtools",
  "azure-iot",
  "azure-management",
  "azure-media",
  "azure-general",
];

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
    // Registered ids are valid via `hasElement`. Structural ones also sit on
    // BUILTIN_COMPONENT_TYPES until that list is retired; cloud categories
    // never did, so the BUILTIN check only applies off the cloud prefixes.
    expect(sanitizeComponentType(type)).toBe(type);
    if (!type.startsWith("gcp-") && !type.startsWith("aws-") && !type.startsWith("azure-")) {
      expect(BUILTIN_COMPONENT_TYPES.has(type)).toBe(true);
    }
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
    // A height is optional — omitted means the node measures itself — but a
    // declared one must be a real size.
    if (size.height !== undefined) expect(size.height).toBeGreaterThan(0);
  });
});

describe("a fixed-size element paints at the size it was created at", () => {
  /**
   * The promise `derivesSize: false` makes.
   *
   * db-table shipped a `defaultSize` of 180 while the node painted at 76, and
   * nothing noticed because nothing read the field. Now that it governs
   * creation, a disagreement between the two is a node that jumps size the
   * moment it is first painted — so the elements that claim a fixed size are
   * held to it here.
   */
  const fixedSized = allElements().filter((element) => !element.canvas.derivesSize);

  it("covers at least one element", () => {
    // Guards against the check silently covering nothing.
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
  /**
   * Every built-in type except the four C4 ones and the remaining cloud
   * families (AWS, Azure) now lives on the element registry. What remains in
   * the old array is the catch-all, plus whatever a plugin splices in ahead of
   * it at runtime. GCP moved in F4; Azure in F5a; AWS follows in F5b; C4 and the
   * catch-all go later.
   */
  it("holds only the C4 catch-all", () => {
    expect(NODE_TYPE_REGISTRY.map((descriptor) => descriptor.rfType)).toEqual(["c4"]);
  });

  it("covers every built-in type between the two registries", () => {
    const owned = new Set<string>(registeredIds);
    // The C4 four are the only BUILTIN entries the catch-all still answers for.
    // Cloud categories were never on BUILTIN — they enter via the registry.
    const stillLegacy = [...BUILTIN_COMPONENT_TYPES].filter((type) => !owned.has(type));
    expect(stillLegacy.sort()).toEqual(["component", "container", "person", "system"]);
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
