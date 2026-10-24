import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import i18n from "@/infrastructure/i18n";
import { FlowAppearanceSection } from "./FlowAppearanceSection";

/**
 * Picking a part's default clears it instead of storing it — the defaults are
 * resolved at render, and a stored default would move the diagram's checksum
 * for no visible change.
 */
function renderSection(appearance: Parameters<typeof FlowAppearanceSection>[0]["appearance"]) {
  const onChange = vi.fn();
  render(<FlowAppearanceSection appearance={appearance} onChange={onChange} />);
  return onChange;
}

const radio = (key: string) => {
  const group = key.startsWith("elementPanel.fill") ? "elementPanel.fill" : "elementPanel.stroke";
  return within(screen.getByRole("radiogroup", { name: i18n.t(group) })).getByRole("radio", {
    name: i18n.t(key),
  });
};

describe("FlowAppearanceSection", () => {
  it("shows the defaults as checked when nothing is stored", () => {
    renderSection({});
    expect(radio("elementPanel.fillNone").getAttribute("aria-checked")).toBe("true");
    expect(radio("elementPanel.strokeSolid").getAttribute("aria-checked")).toBe("true");
  });

  it("leaves colour to the floating toolbar", () => {
    renderSection({});
    expect(screen.queryByRole("button", { name: i18n.t("canvas.quickActions.color") })).toBeNull();
  });

  it("stores a non-default fill and clears the default one", () => {
    const onChange = renderSection({ fill: "soft" });
    fireEvent.click(radio("elementPanel.fillSolid"));
    expect(onChange).toHaveBeenLastCalledWith({ fill: "solid" });
    fireEvent.click(radio("elementPanel.fillNone"));
    expect(onChange).toHaveBeenLastCalledWith({ fill: undefined });
  });

  it("stores a dashed stroke and clears the solid one", () => {
    const onChange = renderSection({});
    fireEvent.click(radio("elementPanel.strokeDashed"));
    expect(onChange).toHaveBeenLastCalledWith({ stroke: "dashed" });
    fireEvent.click(radio("elementPanel.strokeSolid"));
    expect(onChange).toHaveBeenLastCalledWith({ stroke: undefined });
  });

  it("turns a legacy nodeColor into the accent when a fill is chosen", () => {
    const onChange = renderSection({ nodeColor: "#ff0000" });
    // A legacy colour reads as solid.
    expect(radio("elementPanel.fillSolid").getAttribute("aria-checked")).toBe("true");
    fireEvent.click(radio("elementPanel.fillNone"));
    expect(onChange).toHaveBeenLastCalledWith({
      fill: undefined,
      customColor: "#ff0000",
      nodeColor: undefined,
    });
  });

  it("stores solid on evidence, whose default is dashed", () => {
    const onChange = renderSection({ flowShape: "evidence" });
    expect(radio("elementPanel.strokeDashed").getAttribute("aria-checked")).toBe("true");
    fireEvent.click(radio("elementPanel.strokeSolid"));
    expect(onChange).toHaveBeenLastCalledWith({ stroke: "solid" });
    fireEvent.click(radio("elementPanel.strokeDashed"));
    expect(onChange).toHaveBeenLastCalledWith({ stroke: undefined });
  });

  it("stores solid on evidence, whose default is dashed", () => {
    const onChange = renderSection({ flowShape: "evidence" });
    expect(radio("elementPanel.strokeDashed").getAttribute("aria-checked")).toBe("true");
    fireEvent.click(radio("elementPanel.strokeSolid"));
    expect(onChange).toHaveBeenLastCalledWith({ stroke: "solid" });
    fireEvent.click(radio("elementPanel.strokeDashed"));
    expect(onChange).toHaveBeenLastCalledWith({ stroke: undefined });
  });
});
