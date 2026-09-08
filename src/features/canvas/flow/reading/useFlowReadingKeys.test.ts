import { describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/dom";
import { renderHook } from "@testing-library/react";
import { useFlowReadingKeys } from "./useFlowReadingKeys";

/**
 * The keys a reading answers to.
 *
 * They lived in the workspace page, so a shared diagram could only be read by
 * clicking — the viewer runs the same playback machine and had no way to reach
 * the rule.
 */
function bind(overrides: { isReading?: boolean; isCondition?: boolean } = {}) {
  const calls = {
    onGoNext: vi.fn(),
    onGoBack: vi.fn(),
    onExit: vi.fn(),
    onStepOver: vi.fn(),
    onStepOut: vi.fn(),
  };
  const view = renderHook(
    (props: { isReading: boolean; isCondition: boolean }) =>
      useFlowReadingKeys({ ...props, ...calls }),
    {
      initialProps: {
        isReading: overrides.isReading ?? true,
        isCondition: overrides.isCondition ?? false,
      },
    },
  );
  return { ...calls, view };
}

const press = (key: string, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(document, { key, ...init });

describe("walking a reading from the keyboard", () => {
  it("goes forward and back with the arrows", () => {
    const { onGoNext, onGoBack } = bind();

    press("ArrowRight");
    press("ArrowLeft");

    expect(onGoNext).toHaveBeenCalledTimes(1);
    expect(onGoBack).toHaveBeenCalledTimes(1);
  });

  it("closes the reading with escape", () => {
    const { onExit } = bind();

    press("Escape");

    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("will not pick a way forward at a branch point", () => {
    const { onGoNext, onGoBack } = bind({ isCondition: true });

    press("ArrowRight");
    press("ArrowLeft");

    expect(onGoNext).not.toHaveBeenCalled();
    // Back is still back: the choice is ahead, not behind.
    expect(onGoBack).toHaveBeenCalledTimes(1);
  });

  it("steps over a call and out of one, the debugger's own keys", () => {
    const { onStepOver, onStepOut } = bind();

    press("F10");
    press("F11", { shiftKey: true });

    expect(onStepOver).toHaveBeenCalledTimes(1);
    expect(onStepOut).toHaveBeenCalledTimes(1);
  });

  it("leaves F11 alone, which is the browser's fullscreen", () => {
    const { onStepOut } = bind();

    press("F11");

    expect(onStepOut).not.toHaveBeenCalled();
  });

  it("binds nothing while no reading is open", () => {
    const { onGoNext, onExit } = bind({ isReading: false });

    press("ArrowRight");
    press("Escape");

    expect(onGoNext).not.toHaveBeenCalled();
    expect(onExit).not.toHaveBeenCalled();
  });

  it("lets go when the reading closes", () => {
    const { onGoNext, view } = bind();

    view.rerender({ isReading: false, isCondition: false });
    press("ArrowRight");

    expect(onGoNext).not.toHaveBeenCalled();
  });
});
