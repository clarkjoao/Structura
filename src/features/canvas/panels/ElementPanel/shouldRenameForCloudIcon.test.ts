import { describe, expect, it } from "vitest";
import { shouldRenameForCloudIcon } from "./shouldRenameForCloudIcon";

const base = {
  hasCloudCatalogEntry: true,
  businessServiceId: undefined as string | undefined,
  currentName: "",
  defaultNamePrefix: "New",
};

describe("shouldRenameForCloudIcon", () => {
  it("renames empty names so a fresh cloud node picks up the catalog label", () => {
    expect(shouldRenameForCloudIcon({ ...base, currentName: "" })).toBe(true);
    expect(shouldRenameForCloudIcon({ ...base, currentName: "   " })).toBe(true);
  });

  it("renames default placeholder names", () => {
    expect(shouldRenameForCloudIcon({ ...base, currentName: "New system" })).toBe(true);
  });

  it("does not rename a customized name without a business service link", () => {
    expect(shouldRenameForCloudIcon({ ...base, currentName: "Checkout API" })).toBe(false);
  });

  it("never renames when a business service is linked — icon only", () => {
    expect(
      shouldRenameForCloudIcon({
        ...base,
        businessServiceId: "svc-pay",
        currentName: "Payments",
      }),
    ).toBe(false);
    expect(
      shouldRenameForCloudIcon({
        ...base,
        businessServiceId: "svc-pay",
        currentName: "",
      }),
    ).toBe(false);
    expect(
      shouldRenameForCloudIcon({
        ...base,
        businessServiceId: "svc-pay",
        currentName: "New system",
      }),
    ).toBe(false);
  });

  it("does not rename when there is no cloud catalog entry", () => {
    expect(
      shouldRenameForCloudIcon({
        ...base,
        hasCloudCatalogEntry: false,
        currentName: "",
      }),
    ).toBe(false);
  });
});
