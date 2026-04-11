import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useStableListByRefEquality } from "./useStableListByRefEquality";

describe("useStableListByRefEquality", () => {
  it("returns the same array reference when contents are referentially equal", () => {
    const a = { id: "1" };
    const b = { id: "2" };
    const first = [a, b];

    const { result, rerender } = renderHook(
      ({ list }: { list: typeof first }) => useStableListByRefEquality(list),
      { initialProps: { list: first } },
    );

    const stable = result.current;
    expect(stable).toBe(first);

    const second = [a, b];
    rerender({ list: second });
    expect(result.current).toBe(stable);
  });

  it("returns a new reference when an element reference changes", () => {
    const a = { id: "1" };
    const b1 = { id: "2" };
    const b2 = { id: "2" };
    type Row = { id: string };

    const { result, rerender } = renderHook(
      ({ list }: { list: Row[] }) => useStableListByRefEquality(list),
      { initialProps: { list: [a, b1] } },
    );

    const firstStable = result.current;
    rerender({ list: [a, b2] });
    expect(result.current).not.toBe(firstStable);
    expect(result.current[1]).toBe(b2);
  });
});
