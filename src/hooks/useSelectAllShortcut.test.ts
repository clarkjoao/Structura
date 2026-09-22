import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSelectAllShortcut } from "./useSelectAllShortcut";

function pressA(init: KeyboardEventInit = {}, target: EventTarget = window) {
  const event = new KeyboardEvent("keydown", {
    key: "a",
    metaKey: true,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("useSelectAllShortcut", () => {
  it("fires on Cmd+A and prevents the browser's select-all", () => {
    const onSelectAll = vi.fn();
    renderHook(() => useSelectAllShortcut(onSelectAll));

    const event = pressA();

    expect(onSelectAll).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it("fires on Ctrl+A", () => {
    const onSelectAll = vi.fn();
    renderHook(() => useSelectAllShortcut(onSelectAll));

    pressA({ metaKey: false, ctrlKey: true });

    expect(onSelectAll).toHaveBeenCalledTimes(1);
  });

  it("ignores A without a modifier, and modifier combos that mean something else", () => {
    const onSelectAll = vi.fn();
    renderHook(() => useSelectAllShortcut(onSelectAll));

    pressA({ metaKey: false });
    pressA({ shiftKey: true });
    pressA({ altKey: true });

    expect(onSelectAll).not.toHaveBeenCalled();
  });

  it("leaves Cmd+A alone while the user is typing", () => {
    const onSelectAll = vi.fn();
    renderHook(() => useSelectAllShortcut(onSelectAll));
    const input = document.createElement("input");
    document.body.append(input);

    const event = pressA({}, input);

    expect(onSelectAll).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("leaves Cmd+A alone while a dialog is open", () => {
    const onSelectAll = vi.fn();
    renderHook(() => useSelectAllShortcut(onSelectAll));
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.append(dialog);

    pressA();

    expect(onSelectAll).not.toHaveBeenCalled();
  });

  it("does nothing when disabled, and stops listening on unmount", () => {
    const onSelectAll = vi.fn();
    const disabled = renderHook(() => useSelectAllShortcut(onSelectAll, false));
    pressA();
    expect(onSelectAll).not.toHaveBeenCalled();
    disabled.unmount();

    const active = renderHook(() => useSelectAllShortcut(onSelectAll));
    active.unmount();
    pressA();

    expect(onSelectAll).not.toHaveBeenCalled();
  });
});
