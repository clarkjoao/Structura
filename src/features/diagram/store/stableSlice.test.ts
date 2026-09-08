/**
 * The point of `stableSlice` is identity: consumers re-render only when one of
 * the named values actually changes, and nothing is allocated while they don't.
 */
import { describe, expect, it } from "vitest";
import { createStableSlice } from "./stableSlice";

interface Store {
  a: () => void;
  b: () => void;
  c: number;
}

const noop = () => {};
const other = () => {};

describe("createStableSlice", () => {
  it("picks exactly the named keys", () => {
    const select = createStableSlice<Store>()(["a", "c"]);
    expect(select({ a: noop, b: other, c: 1 })).toEqual({ a: noop, c: 1 });
  });

  it("keeps the same object when the named values are unchanged", () => {
    const select = createStableSlice<Store>()(["a", "c"]);
    const first = select({ a: noop, b: other, c: 1 });
    const second = select({ a: noop, b: other, c: 1 });
    expect(second).toBe(first);
  });

  it("ignores changes to keys it does not name", () => {
    const select = createStableSlice<Store>()(["a"]);
    const first = select({ a: noop, b: other, c: 1 });
    const second = select({ a: noop, b: noop, c: 99 });
    expect(second).toBe(first);
  });

  it("rebuilds when a named value changes", () => {
    const select = createStableSlice<Store>()(["a", "c"]);
    const first = select({ a: noop, b: other, c: 1 });
    const second = select({ a: noop, b: other, c: 2 });
    expect(second).not.toBe(first);
    expect(second).toEqual({ a: noop, c: 2 });
  });

  it("rebuilds when a named function is replaced, as a test double would", () => {
    const select = createStableSlice<Store>()(["a", "c"]);
    const first = select({ a: noop, b: other, c: 1 });
    const second = select({ a: other, b: other, c: 1 });
    expect(second).not.toBe(first);
    expect(second.a).toBe(other);
  });

  it("gives each selector its own cache", () => {
    const build = createStableSlice<Store>();
    const selectA = build(["a"]);
    const selectC = build(["c"]);
    const state = { a: noop, b: other, c: 1 };
    expect(selectA(state)).toEqual({ a: noop });
    expect(selectC(state)).toEqual({ c: 1 });
    expect(selectA(state)).toBe(selectA(state));
  });
});
