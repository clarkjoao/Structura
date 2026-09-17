import { describe, expect, it } from "vitest";
import { sortComponents, type SortComponentsOptions } from "./sortComponents";
import type { Component } from "@/features/diagram";
import { isPanelComponent, isApiGroupComponent } from "@/features/diagram";

describe("sortComponents", () => {
  // Helper to create a minimal component fixture
  const makeComponent = (
    id: string,
    type: Component["type"],
    parentId: string | null = null,
  ): Component => ({
    id,
    type,
    name: id,
    description: "",
    parentId,
  } as Component);

  const emptyOpts: SortComponentsOptions = {
    resolvedComponents: {},
    collapsedPanelIds: new Set(),
  };

  it("handles empty input", () => {
    const result = sortComponents([], emptyOpts);
    expect(result).toEqual([]);
  });

  it("sorts groups/panels before non-groups", () => {
    const panel = makeComponent("panel-1", "panel");
    const system = makeComponent("system-1", "system");

    const resolvedComponents: Record<string, Component> = {
      "panel-1": panel,
      "system-1": system,
    };

    const result = sortComponents([system, panel], {
      resolvedComponents,
      collapsedPanelIds: new Set(),
    });

    // Panel should come first
    expect(result[0].id).toBe("panel-1");
    expect(result[1].id).toBe("system-1");
  });

  it("sorts by depth ascending (shallow first)", () => {
    const rootSystem = makeComponent("root-sys", "system", undefined);
    const childComponent = makeComponent("child-cmp", "component", "root-sys");
    const grandchildComponent = makeComponent("gc-cmp", "component", "child-cmp");

    const resolvedComponents: Record<string, Component> = {
      "root-sys": rootSystem,
      "child-cmp": childComponent,
      "gc-cmp": grandchildComponent,
    };

    const result = sortComponents([grandchildComponent, childComponent, rootSystem], {
      resolvedComponents,
      collapsedPanelIds: new Set(),
    });

    // Should be sorted by depth: root (0), child (1), grandchild (2)
    expect(result.map((c) => c.id)).toEqual(["root-sys", "child-cmp", "gc-cmp"]);
  });

  it("uses stable id tiebreak when depth is equal", () => {
    const systemA = makeComponent("a-system", "system");
    const systemB = makeComponent("b-system", "system");
    const systemC = makeComponent("c-system", "system");

    const resolvedComponents: Record<string, Component> = {
      "a-system": systemA,
      "b-system": systemB,
      "c-system": systemC,
    };

    // All at same depth, should sort by id
    const result = sortComponents([systemC, systemA, systemB], {
      resolvedComponents,
      collapsedPanelIds: new Set(),
    });

    expect(result.map((c) => c.id)).toEqual(["a-system", "b-system", "c-system"]);
  });

  it("handles api-group components (groups-first)", () => {
    const apiGroup = makeComponent("api-1", "api-group");
    const container = makeComponent("container-1", "container");

    const resolvedComponents: Record<string, Component> = {
      "api-1": apiGroup,
      "container-1": container,
    };

    const result = sortComponents([container, apiGroup], {
      resolvedComponents,
      collapsedPanelIds: new Set(),
    });

    // API group should come first (it's also a group)
    expect(result[0].id).toBe("api-1");
    expect(result[1].id).toBe("container-1");
  });

  it("combines groups-first, depth, and id tiebreak", () => {
    // Create a mix: panel at root, system at depth 1, another system at root
    const panel = makeComponent("panel-root", "panel");
    const rootSystem = makeComponent("root-sys", "system");
    const childSystem = makeComponent("child-sys", "system", "root-sys");
    const anotherRootSystem = makeComponent("aaa-root-sys", "system");

    const resolvedComponents: Record<string, Component> = {
      "panel-root": panel,
      "root-sys": rootSystem,
      "child-sys": childSystem,
      "aaa-root-sys": anotherRootSystem,
    };

    const result = sortComponents(
      [childSystem, panel, rootSystem, anotherRootSystem],
      { resolvedComponents, collapsedPanelIds: new Set() },
    );

    // Expected order:
    // 1. panel-root (group, depth 0)
    // 2. aaa-root-sys (non-group, depth 0, id comes before root-sys)
    // 3. root-sys (non-group, depth 0)
    // 4. child-sys (non-group, depth 1)
    expect(result.map((c) => c.id)).toEqual([
      "panel-root",
      "aaa-root-sys",
      "root-sys",
      "child-sys",
    ]);
  });
});
