import { afterEach, describe, expect, it } from "vitest";
import { contrastLabelColor } from "@/features/diagram/utils/labelContrast";
import { resolveThemeColor } from "./useOnAccentColor";

describe("resolveThemeColor", () => {
  afterEach(() => {
    document.documentElement.style.removeProperty("--node-person");
  });

  it("reads a preset token from the active theme", () => {
    document.documentElement.style.setProperty("--node-person", "38 92% 50%");
    expect(resolveThemeColor("hsl(var(--node-person))")).toBe("hsl(38 92% 50%)");
  });

  it("leaves a concrete colour alone", () => {
    expect(resolveThemeColor("#1d9eaf")).toBe("#1d9eaf");
  });

  it("returns the token itself when the theme does not define it", () => {
    expect(resolveThemeColor("hsl(var(--not-a-token))")).toBe("hsl(var(--not-a-token))");
  });
});

describe("text on a solid accent is picked by contrast, not by list", () => {
  it("writes dark on amber", () => {
    expect(contrastLabelColor("hsl(38 92% 50%)", 100)).toBe("#0a0a0a");
  });

  it("writes light on violet", () => {
    expect(contrastLabelColor("hsl(260 60% 48%)", 100)).toBe("#ffffff");
  });
});
