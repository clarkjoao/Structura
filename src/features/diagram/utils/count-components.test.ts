import { describe, expect, it } from "vitest";
import type { Component } from "../model/component.types";
import { countComponents } from "./count-components";

const component = (id: string, type: string): Component =>
  ({ id, name: id, description: "", parentId: null, type }) as Component;

describe("countComponents", () => {
  it("does not count free text", () => {
    const components = Object.fromEntries(
      [component("a", "container"), component("b", "note"), component("t", "text")].map((c) => [
        c.id,
        c,
      ]),
    );
    expect(countComponents(components)).toBe(2);
  });
});
