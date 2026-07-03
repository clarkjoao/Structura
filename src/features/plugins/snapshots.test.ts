import { describe, expect, it } from "vitest";
import type { Component, Connection, Diagram, ServiceDefinition } from "@/features/diagram";
import {
  sanitizeComponentPatch,
  sanitizeServicePatch,
  toComponentSnapshot,
  toConnectionSnapshot,
  toDiagramSnapshot,
  toServiceSnapshot,
} from "./snapshots";
import type { PluginComponentPatch, PluginServicePatch } from "./plugin.types";

const component: Component = {
  id: "c1",
  type: "system",
  name: "Billing",
  description: "Billing system",
  parentId: null,
  tags: ["core"],
};

const connection: Connection = {
  id: "e1",
  sourceId: "c1",
  targetId: "c2",
  label: "calls",
  technology: "gRPC",
};

const service: ServiceDefinition = {
  id: "s1",
  name: "billing-svc",
  description: "Billing service",
  repositoryUrl: "https://example.com/billing",
  technology: ["node"],
  owner: "team-billing",
};

describe("toComponentSnapshot", () => {
  it("projects component fields and layout position/size", () => {
    const snapshot = toComponentSnapshot(component, {
      elementId: "c1",
      x: 10,
      y: 20,
      width: 200,
      height: 100,
    });
    expect(snapshot).toEqual({
      id: "c1",
      type: "system",
      label: "Billing",
      description: "Billing system",
      position: { x: 10, y: 20 },
      size: { width: 200, height: 100 },
      tags: ["core"],
      serviceId: null,
    });
  });

  it("returns null position/size when nothing is known", () => {
    const snapshot = toComponentSnapshot(component);
    expect(snapshot.position).toBeNull();
    expect(snapshot.size).toBeNull();
  });
});

describe("toConnectionSnapshot / toServiceSnapshot", () => {
  it("projects connections with null defaults", () => {
    expect(toConnectionSnapshot(connection)).toEqual({
      id: "e1",
      sourceId: "c1",
      targetId: "c2",
      label: "calls",
      description: null,
      technology: "gRPC",
    });
  });

  it("projects services", () => {
    expect(toServiceSnapshot(service).owner).toBe("team-billing");
    expect(toServiceSnapshot(service).technology).toEqual(["node"]);
  });
});

describe("toDiagramSnapshot", () => {
  it("projects all components and connections", () => {
    const diagram: Diagram = {
      id: "d1",
      name: "Context",
      level: "context",
      createdAt: 0,
      updatedAt: 0,
      snapshot: {
        components: { c1: component },
        connections: { e1: connection },
        flows: {},
        iconLibrary: {},
      },
      nodeLayouts: { c1: { elementId: "c1", x: 1, y: 2 } },
      edgeLayouts: {},
      viewport: { x: 0, y: 0, zoom: 1 },
    };
    const snapshot = toDiagramSnapshot(diagram);
    expect(snapshot.components).toHaveLength(1);
    expect(snapshot.components[0].position).toEqual({ x: 1, y: 2 });
    expect(snapshot.connections).toHaveLength(1);
    expect(snapshot.description).toBeNull();
  });
});

describe("patch sanitizers", () => {
  it("keeps only whitelisted component fields", () => {
    // Simulates untyped plugin JS: extra fields and wrong element types must be dropped.
    const raw: Record<string, unknown> = {
      name: "New name",
      description: "New description",
      tags: ["a", 42],
      parentId: "sneaky",
      locked: true,
    };
    const patch = raw as PluginComponentPatch;
    expect(sanitizeComponentPatch(patch)).toEqual({
      name: "New name",
      description: "New description",
      tags: ["a"],
    });
  });

  it("keeps only whitelisted service fields", () => {
    const raw: Record<string, unknown> = {
      name: "svc",
      repositoryUrl: "https://example.com",
      sources: [{ evil: true }],
      metadata: { github: {} },
    };
    const patch = raw as PluginServicePatch;
    expect(sanitizeServicePatch(patch)).toEqual({
      name: "svc",
      repositoryUrl: "https://example.com",
    });
  });
});
