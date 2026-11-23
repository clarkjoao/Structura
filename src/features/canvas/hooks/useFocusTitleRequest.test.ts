import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { useFocusTitleRequest } from "./useFocusTitleRequest";

function setup() {
  return renderHook(
    ({ node }: { node: string | null }) => {
      const [trigger, setTrigger] = useState(0);
      const request = useFocusTitleRequest(node, null, setTrigger);
      return { trigger, request };
    },
    { initialProps: { node: "a" as string | null } },
  );
}

describe("useFocusTitleRequest", () => {
  it("focuses the current selection at once", () => {
    const hook = setup();
    act(() => hook.result.current.request());
    expect(hook.result.current.trigger).toBe(1);
  });

  it("waits for the element it names, so the selection change cannot cancel it", () => {
    const hook = setup();
    act(() => hook.result.current.request("b"));
    expect(hook.result.current.trigger).toBe(0);
    hook.rerender({ node: "b" });
    expect(hook.result.current.trigger).toBe(1);
  });

  it("still lets go when the selection moves elsewhere", () => {
    const hook = setup();
    act(() => hook.result.current.request());
    hook.rerender({ node: "c" });
    expect(hook.result.current.trigger).toBe(0);
  });
});
