import { describe, expect, it, vi } from "vitest";
import type { Component, Connection } from "@/features/diagram";

vi.mock("@/features/diagram", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/features/diagram")>();
  return {
    ...mod,
    generateId: vi.fn(() => "tpl-mock-id"),
  };
});

import {
  captureSelectionAsTemplate,
  expandSelectionWithChildren,
} from "@/features/canvas/utils/capture-template";

function container(id: string, parentId: string | null = null): Component {
  return {
    type: "container",
    id,
    name: id,
    description: "",
    parentId,
  };
}

function panel(id: string, parentId: string | null = null): Component {
  return {
    type: "panel",
    id,
    name: id,
    description: "",
    parentId,
  };
}

describe("captureSelectionAsTemplate", () => {
  it("includes a connection when both endpoints are selected", () => {
    const allComponents: Record<string, Component> = {
      a: container("a"),
      b: container("b"),
    };
    const allConnections: Record<string, Connection> = {
      c1: {
        id: "c1",
        sourceId: "a",
        targetId: "b",
        label: "calls",
      },
    };
    const nodeLayouts = [
      { elementId: "a", x: 0, y: 0 },
      { elementId: "b", x: 0, y: 0 },
    ];

    const template = captureSelectionAsTemplate(
      ["a", "b"],
      allComponents,
      allConnections,
      nodeLayouts,
      "T",
    );

    expect(template.components).toHaveLength(2);
    expect(template.connections).toHaveLength(1);
    expect(template.connections[0]).toMatchObject({
      label: "calls",
      sourceIndex: 0,
      targetIndex: 1,
    });
    expect(template.connections[0]).not.toHaveProperty("id");
    expect(template.connections[0]).not.toHaveProperty("sourceId");
    expect(template.connections[0]).not.toHaveProperty("targetId");
  });

  it("drops a connection when one endpoint is outside the selection", () => {
    const allComponents: Record<string, Component> = {
      a: container("a"),
      b: container("b"),
      c: container("c"),
    };
    const allConnections: Record<string, Connection> = {
      c1: {
        id: "c1",
        sourceId: "a",
        targetId: "c",
        label: "out",
      },
    };
    const nodeLayouts = [
      { elementId: "a", x: 0, y: 0 },
      { elementId: "b", x: 0, y: 0 },
      { elementId: "c", x: 0, y: 0 },
    ];

    const template = captureSelectionAsTemplate(
      ["a", "b"],
      allComponents,
      allConnections,
      nodeLayouts,
      "T",
    );

    expect(template.components).toHaveLength(2);
    expect(template.connections).toHaveLength(0);
  });

  it("stores centroid-relative geometry as _relX and _relY", () => {
    const allComponents: Record<string, Component> = {
      a: container("a"),
      b: container("b"),
    };
    const allConnections: Record<string, Connection> = {};
    const nodeLayouts = [
      { elementId: "a", x: 0, y: 0 },
      { elementId: "b", x: 10, y: 0 },
    ];

    const template = captureSelectionAsTemplate(
      ["a", "b"],
      allComponents,
      allConnections,
      nodeLayouts,
      "T",
    );

    expect(template.components[0]).toMatchObject({ _relX: -5, _relY: 0 });
    expect(template.components[1]).toMatchObject({ _relX: 5, _relY: 0 });
    expect(template.components[0]).not.toHaveProperty("id");
    expect(template.components[0]).not.toHaveProperty("parentId");
    expect(template.components[0]).not.toHaveProperty("x");
    expect(template.components[0]).not.toHaveProperty("y");
  });

  it("includes panel children when only the panel is selected", () => {
    const allComponents: Record<string, Component> = {
      p: panel("p", null),
      c1: container("c1", "p"),
      c2: container("c2", "p"),
    };
    const nodeLayouts = [
      { elementId: "p", x: 0, y: 0 },
      { elementId: "c1", x: 10, y: 0 },
      { elementId: "c2", x: 20, y: 0 },
    ];

    const template = captureSelectionAsTemplate(
      ["p"],
      allComponents,
      {},
      nodeLayouts,
      "T",
    );

    expect(template.components).toHaveLength(3);
    const names = template.components.map((c) => c.name).sort();
    expect(names).toEqual(["c1", "c2", "p"]);
  });

  it("preserves parentIndex from panel to child", () => {
    const allComponents: Record<string, Component> = {
      p: panel("p", null),
      c1: container("c1", "p"),
    };
    const nodeLayouts = [
      { elementId: "p", x: 0, y: 0 },
      { elementId: "c1", x: 10, y: 0 },
    ];

    const template = captureSelectionAsTemplate(
      ["p"],
      allComponents,
      {},
      nodeLayouts,
      "T",
    );

    const panelEntry = template.components.find((c) => c.name === "p");
    const childEntry = template.components.find((c) => c.name === "c1");
    expect(panelEntry).toBeDefined();
    expect(childEntry).toBeDefined();
    expect(panelEntry!.parentIndex).toBeUndefined();
    const panelIndex = template.components.findIndex((c) => c.name === "p");
    expect(childEntry!.parentIndex).toBe(panelIndex);
  });

  it("includes nested panel descendants recursively when the outer panel is selected", () => {
    const allComponents: Record<string, Component> = {
      a: panel("a", null),
      b: panel("b", "a"),
      c: container("c", "b"),
    };
    const nodeLayouts = [
      { elementId: "a", x: 0, y: 0 },
      { elementId: "b", x: 10, y: 0 },
      { elementId: "c", x: 20, y: 0 },
    ];

    const template = captureSelectionAsTemplate(
      ["a"],
      allComponents,
      {},
      nodeLayouts,
      "T",
    );

    expect(template.components).toHaveLength(3);
    const byName = Object.fromEntries(template.components.map((co) => [co.name, co]));
    expect(byName.a.parentIndex).toBeUndefined();
    expect(byName.b.parentIndex).toBe(template.components.findIndex((x) => x.name === "a"));
    expect(byName.c.parentIndex).toBe(template.components.findIndex((x) => x.name === "b"));
  });

  it("omits parentIndex when only the child is selected and the parent is outside the template", () => {
    const allComponents: Record<string, Component> = {
      p: panel("p", null),
      c1: container("c1", "p"),
    };
    const nodeLayouts = [
      { elementId: "p", x: 0, y: 0 },
      { elementId: "c1", x: 10, y: 0 },
    ];

    const template = captureSelectionAsTemplate(
      ["c1"],
      allComponents,
      {},
      nodeLayouts,
      "T",
    );

    expect(template.components).toHaveLength(1);
    expect(template.components[0].parentIndex).toBeUndefined();
  });
});

describe("expandSelectionWithChildren", () => {
  it("returns ids in parent-before-child order", () => {
    const allComponents: Record<string, Component> = {
      p: panel("p", null),
      c1: container("c1", "p"),
    };
    const ordered = expandSelectionWithChildren(["p"], allComponents);
    expect(ordered).toEqual(["p", "c1"]);
  });
});
