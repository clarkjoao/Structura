import { describe, expect, it } from "vitest";
import type { Component } from "@/features/diagram";
import { resolveSelectionFocus } from "./nodeVisibility";

/**
 * Free text is a decoration: selecting one takes no focus from the diagram, and
 * a text is never dimmed because something else is selected.
 */

const component = (id: string, type = "system") =>
  ({ id, name: id, type, parentId: null }) as unknown as Component;

const focusOf = (comp: Component, selected: string[], selectionIsDecoration = false) =>
  resolveSelectionFocus(
    comp,
    false,
    false,
    new Set(selected),
    new Set<string>(),
    selectionIsDecoration,
  );

describe("selecting a text", () => {
  it("dims nothing when only text is selected", () => {
    expect(focusOf(component("a"), ["t"], true).dimmedBySelection).toBe(false);
  });

  it("still dims the rest when a real element is selected", () => {
    expect(focusOf(component("a"), ["b"], false).dimmedBySelection).toBe(true);
  });
});

describe("a text under someone else's selection", () => {
  it("is not dimmed", () => {
    expect(focusOf(component("t", "text"), ["b"], false).dimmedBySelection).toBe(false);
  });
});
