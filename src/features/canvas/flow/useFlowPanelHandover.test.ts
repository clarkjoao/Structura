import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useFlowPanelHandover } from "./useFlowPanelHandover";

/**
 * Editing used to leave the flows panel closed behind it, and that was nearly
 * free: a flow's steps were also reachable from a card in the list, so the
 * list was one of two ways in. It is the only one now.
 */
function renderHandover(isRecording: boolean, isCollaborating = false) {
  const setShowFlows = vi.fn();
  const view = renderHook(
    (props: { isRecording: boolean; isCollaborating: boolean }) =>
      useFlowPanelHandover({ ...props, setShowFlows }),
    { initialProps: { isRecording, isCollaborating } },
  );
  return { setShowFlows, view };
}

describe("the hand-off between the list and the editing panel", () => {
  it("puts the list away when a session starts", () => {
    const { setShowFlows, view } = renderHandover(false);
    setShowFlows.mockClear();

    view.rerender({ isRecording: true, isCollaborating: false });

    expect(setShowFlows).toHaveBeenCalledWith(false);
  });

  it("brings it back when the session ends", () => {
    const { setShowFlows, view } = renderHandover(true);
    setShowFlows.mockClear();

    view.rerender({ isRecording: false, isCollaborating: false });

    expect(setShowFlows).toHaveBeenCalledWith(true);
  });

  it("leaves the panel alone when no session ever ran", () => {
    const { setShowFlows, view } = renderHandover(false);
    setShowFlows.mockClear();

    view.rerender({ isRecording: false, isCollaborating: false });

    expect(setShowFlows).not.toHaveBeenCalled();
  });

  it("does not bring it back into a collaboration, where it is not allowed", () => {
    const { setShowFlows, view } = renderHandover(true);
    setShowFlows.mockClear();

    view.rerender({ isRecording: false, isCollaborating: true });

    expect(setShowFlows).not.toHaveBeenCalledWith(true);
  });

  it("hands over again on the next session", () => {
    const { setShowFlows, view } = renderHandover(false);
    view.rerender({ isRecording: true, isCollaborating: false });
    view.rerender({ isRecording: false, isCollaborating: false });
    setShowFlows.mockClear();

    view.rerender({ isRecording: true, isCollaborating: false });
    view.rerender({ isRecording: false, isCollaborating: false });

    expect(setShowFlows).toHaveBeenNthCalledWith(1, false);
    expect(setShowFlows).toHaveBeenNthCalledWith(2, true);
  });
});
