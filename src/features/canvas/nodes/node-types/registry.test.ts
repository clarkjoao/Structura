import { afterEach, describe, expect, it, vi } from "vitest";
import type { NodeTypeDescriptor } from "./types";
import {
  NODE_TYPE_REGISTRY,
  getDescriptor,
  getNodeTypesSnapshot,
  registerDescriptor,
  subscribeNodeTypes,
  unregisterDescriptor,
} from "./registry";
import { COMPONENT_TYPE_UNKNOWN } from "@/features/diagram";
import { SPREAD_HANDLES } from "./handle-spec";

function makeDescriptor(rfType: string, componentType: string): NodeTypeDescriptor {
  return {
    rfType,
    component: () => null,
    matches: (type) => type === componentType,
    zIndex: 1,
    connectable: true,
    handles: SPREAD_HANDLES,
    canHaveParent: true,
    canBeParent: false,
    buildData: () => ({}),
  };
}

const PLUGIN_RF_TYPE = "structura-plugin-test/hexagon";
const PLUGIN_COMPONENT_TYPE = "structura-plugin-test/hexagon";

afterEach(() => {
  unregisterDescriptor(PLUGIN_RF_TYPE);
});

describe("registerDescriptor / unregisterDescriptor", () => {
  it("registers and unregisters cleanly on the plugin-only registry", () => {
    const descriptor = makeDescriptor(PLUGIN_RF_TYPE, PLUGIN_COMPONENT_TYPE);
    const sizeBefore = NODE_TYPE_REGISTRY.length;

    registerDescriptor(descriptor);
    expect(NODE_TYPE_REGISTRY).toContain(descriptor);
    expect(getDescriptor(PLUGIN_COMPONENT_TYPE)).toBe(descriptor);

    unregisterDescriptor(PLUGIN_RF_TYPE);
    expect(NODE_TYPE_REGISTRY.length).toBe(sizeBefore);
  });

  it("throws on duplicate rfType and leaves the registry unchanged", () => {
    registerDescriptor(makeDescriptor(PLUGIN_RF_TYPE, PLUGIN_COMPONENT_TYPE));
    const sizeBefore = NODE_TYPE_REGISTRY.length;
    expect(() => registerDescriptor(makeDescriptor(PLUGIN_RF_TYPE, "other/type"))).toThrowError(
      PLUGIN_RF_TYPE,
    );
    expect(NODE_TYPE_REGISTRY.length).toBe(sizeBefore);
  });

  it("ignores unregistering an unknown rfType", () => {
    const sizeBefore = NODE_TYPE_REGISTRY.length;
    unregisterDescriptor("does-not-exist");
    expect(NODE_TYPE_REGISTRY.length).toBe(sizeBefore);
  });
});

describe("getDescriptor degradation", () => {
  it("falls back to the unknown descriptor for orphaned plugin types", () => {
    expect(getDescriptor(PLUGIN_COMPONENT_TYPE).rfType).toBe(COMPONENT_TYPE_UNKNOWN);
  });

  it("resolves C4 types from the element registry, not a catch-all", () => {
    expect(getDescriptor("person").rfType).toBe("person");
    expect(getDescriptor("system").rfType).toBe("system");
    expect(getDescriptor("container").rfType).toBe("container");
    expect(getDescriptor("component").rfType).toBe("component");
  });

  it("falls back to unknown for unmatched built-in-shaped types (F9)", () => {
    expect(getDescriptor("not-a-real-type" as never).rfType).toBe(COMPONENT_TYPE_UNKNOWN);
  });
});

describe("reactive nodeTypes snapshot", () => {
  it("rebuilds the snapshot and notifies subscribers on register/unregister", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeNodeTypes(listener);
    const before = getNodeTypesSnapshot();
    expect(before[PLUGIN_RF_TYPE]).toBeUndefined();

    registerDescriptor(makeDescriptor(PLUGIN_RF_TYPE, PLUGIN_COMPONENT_TYPE));
    const after = getNodeTypesSnapshot();
    expect(after).not.toBe(before);
    expect(after[PLUGIN_RF_TYPE]).toBeDefined();
    expect(listener).toHaveBeenCalledTimes(1);

    unregisterDescriptor(PLUGIN_RF_TYPE);
    expect(getNodeTypesSnapshot()[PLUGIN_RF_TYPE]).toBeUndefined();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    registerDescriptor(makeDescriptor(PLUGIN_RF_TYPE, PLUGIN_COMPONENT_TYPE));
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
