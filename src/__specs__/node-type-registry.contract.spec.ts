/**
 * Contract: the node-type registry invariants documented in
 * `.cursor/rules/structura-architecture.mdc` and CLAUDE.md.
 *
 * These are executable guarantees for the "c4Descriptor must stay last
 * (catch-all)" and "register via descriptor, never conditionals" rules.
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  NODE_TYPE_REGISTRY,
  getDescriptor,
  registerDescriptor,
  nodeTypes,
  type NodeTypeDescriptor,
} from "@/features/canvas/nodes/node-types";
import {
  COMPONENT_TYPE_PANEL,
  COMPONENT_TYPE_NOTE,
  COMPONENT_TYPE_API_GROUP,
  COMPONENT_TYPE_ENDPOINT,
  COMPONENT_TYPE_DB_TABLE,
  COMPONENT_TYPE_JSON_VIEWER,
  type ComponentType,
} from "@/features/diagram";

const UNKNOWN_TYPE = "__not_a_real_component_type__" as ComponentType;

function makeTestDescriptor(rfType: string): NodeTypeDescriptor {
  return {
    rfType,
    component: () => null,
    matches: () => false,
    zIndex: 0,
    connectable: true,
    canHaveParent: false,
    canBeParent: false,
    buildData: () => ({}),
  };
}

describe("node-type registry contract", () => {
  it("registers c4 as the final catch-all descriptor", () => {
    const last = NODE_TYPE_REGISTRY[NODE_TYPE_REGISTRY.length - 1];
    expect(last.rfType).toBe("c4");
    expect(last.matches(UNKNOWN_TYPE)).toBe(true);
  });

  it("has exactly one catch-all, and it is last", () => {
    const catchAlls = NODE_TYPE_REGISTRY.filter((descriptor) =>
      descriptor.matches(UNKNOWN_TYPE),
    );
    expect(catchAlls).toHaveLength(1);
    expect(catchAlls[0]).toBe(NODE_TYPE_REGISTRY[NODE_TYPE_REGISTRY.length - 1]);
  });

  it("getDescriptor resolves a matching descriptor for every known type", () => {
    const knownTypes: ComponentType[] = [
      COMPONENT_TYPE_PANEL,
      COMPONENT_TYPE_NOTE,
      COMPONENT_TYPE_API_GROUP,
      COMPONENT_TYPE_ENDPOINT,
      COMPONENT_TYPE_DB_TABLE,
      COMPONENT_TYPE_JSON_VIEWER,
    ];
    for (const type of knownTypes) {
      expect(getDescriptor(type).matches(type)).toBe(true);
    }
  });

  it("getDescriptor falls back to the c4 catch-all for unknown types", () => {
    expect(getDescriptor(UNKNOWN_TYPE).rfType).toBe("c4");
  });

  it("exposes a nodeTypes map with no duplicate rfType keys", () => {
    const rfTypes = NODE_TYPE_REGISTRY.map((descriptor) => descriptor.rfType);
    expect(Object.keys(nodeTypes).length).toBe(new Set(rfTypes).size);
  });

  describe("registerDescriptor", () => {
    const TEST_RF_TYPE = "__contract_test_descriptor__";

    afterEach(() => {
      const index = NODE_TYPE_REGISTRY.findIndex(
        (descriptor) => descriptor.rfType === TEST_RF_TYPE,
      );
      if (index !== -1) NODE_TYPE_REGISTRY.splice(index, 1);
    });

    it("inserts new descriptors before the c4 catch-all", () => {
      registerDescriptor(makeTestDescriptor(TEST_RF_TYPE));
      const lastIndex = NODE_TYPE_REGISTRY.length - 1;
      expect(NODE_TYPE_REGISTRY[lastIndex].rfType).toBe("c4");
      expect(NODE_TYPE_REGISTRY[lastIndex - 1].rfType).toBe(TEST_RF_TYPE);
    });

    it("rejects a duplicate rfType", () => {
      expect(() => registerDescriptor(makeTestDescriptor("c4"))).toThrow();
    });
  });
});
