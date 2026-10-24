import { describe, expect, it } from "vitest";
import type { Component } from "../model/component.types";
import { serviceEditOf, serviceSeedFromComponent, splitTechnology } from "./service-sync";

describe("splitTechnology", () => {
  it("splits, trims and drops empties", () => {
    expect(splitTechnology(" Go, gRPC ,, DynamoDB ")).toEqual(["Go", "gRPC", "DynamoDB"]);
    expect(splitTechnology(undefined)).toEqual([]);
  });
});

describe("serviceEditOf", () => {
  it("translates the fields a service lends an element", () => {
    expect(
      serviceEditOf({ name: "n", description: "d", tags: ["a"], technology: "Go, gRPC" } as never),
    ).toEqual({ name: "n", description: "d", tags: ["a"], technology: ["Go", "gRPC"] });
  });

  it("an emptied technology or tags is an emptied list, not a missing one", () => {
    expect(serviceEditOf({ technology: undefined } as never)).toEqual({ technology: [] });
    expect(serviceEditOf({ tags: undefined } as never)).toEqual({ tags: [] });
  });

  it("is empty for fields the service does not own", () => {
    expect(serviceEditOf({ locked: true, parentId: "p" } as never)).toEqual({});
  });
});

describe("serviceSeedFromComponent", () => {
  const component = {
    id: "c",
    name: "Cob API",
    type: "container",
    description: "Takes the orders",
    parentId: null,
    technology: "Go, gRPC",
    tags: ["core"],
    externalLinks: [{ id: "l", label: "Docs", url: "https://d", type: "generic" }],
  } as unknown as Component;

  it("carries what the element says into the new service", () => {
    expect(serviceSeedFromComponent(component)).toMatchObject({
      name: "Cob API",
      description: "Takes the orders",
      technology: ["Go", "gRPC"],
      tags: ["core"],
      sources: [{ type: "manual" }],
    });
    expect(serviceSeedFromComponent(component).externalLinks).toHaveLength(1);
  });

  it("copies the links, so the two do not share objects", () => {
    expect(serviceSeedFromComponent(component).externalLinks?.[0]).not.toBe(
      component.externalLinks?.[0],
    );
  });
});
