import { describe, expect, it } from "vitest";
import { elementDefaultSize, getElement } from "@/features/elements/element.registry";
import { CARD_MAX_W, CARD_MIN_W } from "../CardNode/constants";
import { VSM_SIZE_LIMITS } from "./vsmSizeLimits";

describe("VSM size limits", () => {
  it.each(Object.keys(VSM_SIZE_LIMITS))("%s is created within its own limits", (id) => {
    const size = elementDefaultSize(getElement(id)!);
    const limits = VSM_SIZE_LIMITS[id];
    expect(size.width).toBeGreaterThanOrEqual(limits.minWidth);
    expect(size.width).toBeLessThanOrEqual(limits.maxWidth ?? Infinity);
    expect(size.height ?? limits.minHeight).toBeGreaterThanOrEqual(limits.minHeight);
  });

  it("gives the process box the C4 card's width bounds", () => {
    expect(VSM_SIZE_LIMITS["vsm-process"]).toMatchObject({
      minWidth: CARD_MIN_W,
      maxWidth: CARD_MAX_W,
    });
  });
});
