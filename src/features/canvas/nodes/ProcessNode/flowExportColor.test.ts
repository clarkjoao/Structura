import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FLOW_ACCENT_PRESETS } from "@/features/canvas/panels/ElementPanel/components/colorPresets";
import { LIGHT_THEME_TOKENS, exportColorHex, flowExportColours } from "./flowExportColor";

/** The `:root` (light) block of the app's stylesheet. */
function lightThemeBlock(): string {
  const css = readFileSync(path.resolve(__dirname, "../../../../index.css"), "utf8");
  const start = css.indexOf(":root");
  const end = css.indexOf(".dark", start);
  return css.slice(start, end);
}

describe("LIGHT_THEME_TOKENS", () => {
  it("matches the light theme in index.css", () => {
    const block = lightThemeBlock();
    for (const [token, value] of Object.entries(LIGHT_THEME_TOKENS)) {
      expect(block, token).toContain(`${token}: ${value};`);
    }
  });

  it("covers every flow accent preset", () => {
    for (const preset of FLOW_ACCENT_PRESETS) {
      expect(exportColorHex(preset.color), preset.nameKey).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe("flowExportColours", () => {
  it("exports the slate default when nothing is stored", () => {
    expect(flowExportColours({})).toEqual({ accentColor: "#65758b", fill: "none", dashed: false });
  });

  it("resolves a preset token to its light value and writes dark on amber", () => {
    expect(flowExportColours({ customColor: "hsl(var(--node-person))", fill: "solid" })).toEqual({
      accentColor: "#f59f0a",
      fill: "solid",
      dashed: false,
      fontColor: "#0a0a0a",
    });
  });

  it("keeps a legacy nodeColor as a solid fill", () => {
    expect(flowExportColours({ nodeColor: "#ff0000" })).toMatchObject({
      accentColor: "#ff0000",
      fill: "solid",
    });
  });

  it("carries the dashed stroke", () => {
    expect(flowExportColours({ stroke: "dashed" }).dashed).toBe(true);
  });
});
