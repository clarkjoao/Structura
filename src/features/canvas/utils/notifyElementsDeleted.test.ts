import type { TFunction } from "i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: toastMock }));

import { notifyElementsDeleted, withDeleteFeedback } from "./notifyElementsDeleted";

const t = ((key: string, opts?: { count?: number }) =>
  opts?.count === undefined ? key : `${key}:${opts.count}`) as unknown as TFunction;

describe("notifyElementsDeleted", () => {
  beforeEach(() => toastMock.mockClear());

  it("stays silent for a single element", () => {
    notifyElementsDeleted({ count: 1, undo: vi.fn(), t });
    expect(toastMock).not.toHaveBeenCalled();
  });

  it("announces a bulk delete with an Undo action wired to undo", () => {
    const undo = vi.fn();
    notifyElementsDeleted({ count: 4, undo, t });
    expect(toastMock).toHaveBeenCalledTimes(1);
    const [message, options] = toastMock.mock.calls[0] as [
      string,
      { action: { label: string; onClick: () => void } },
    ];
    expect(message).toBe("canvas.elementsDeleted:4");
    options.action.onClick();
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it("wraps removeElements and counts nodes plus edges", () => {
    const remove = vi.fn();
    withDeleteFeedback(remove, vi.fn(), t)(["a"], ["e"]);
    expect(remove).toHaveBeenCalledWith(["a"], ["e"]);
    expect(toastMock).toHaveBeenCalledTimes(1);
  });
});
