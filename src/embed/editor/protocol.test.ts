import { describe, expect, it } from "vitest";
import { EDITOR_APPLY, THEME, readHostMessage } from "./protocol";

describe("editable embed protocol", () => {
  it("reads an apply request and a theme", () => {
    expect(
      readHostMessage({ type: EDITOR_APPLY, requestId: 3, changes: { remove: ["a"] } }),
    ).toEqual({
      type: EDITOR_APPLY,
      requestId: 3,
      changes: { remove: ["a"] },
    });
    expect(readHostMessage({ type: THEME, theme: "dark" })).toEqual({ type: THEME, theme: "dark" });
  });

  it("ignores anything else", () => {
    for (const data of [
      null,
      "x",
      { type: EDITOR_APPLY, changes: {} },
      { type: EDITOR_APPLY, requestId: 1, changes: null },
      { type: THEME, theme: "blue" },
      { type: "STRUCTURA_EDITOR_SNAPSHOT", diagram: {} },
    ]) {
      expect(readHostMessage(data)).toBeNull();
    }
  });
});
