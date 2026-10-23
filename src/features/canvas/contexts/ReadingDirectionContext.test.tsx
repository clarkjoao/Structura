import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { Position } from "@xyflow/react";
import { ReadingDirectionContext, useHandleSides } from "./ReadingDirectionContext";

describe("useHandleSides", () => {
  it("is left to right without a provider", () => {
    const { result } = renderHook(() => useHandleSides());
    expect(result.current.input).toBe(Position.Left);
    expect(result.current.output).toBe(Position.Right);
  });

  it("follows a top-to-bottom provider", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ReadingDirectionContext.Provider value="TB">{children}</ReadingDirectionContext.Provider>
    );
    const { result } = renderHook(() => useHandleSides(), { wrapper });
    expect(result.current.input).toBe(Position.Top);
    expect(result.current.output).toBe(Position.Bottom);
  });
});
