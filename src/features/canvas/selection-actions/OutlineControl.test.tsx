import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "@/features/elements/bootstrap";
import type { Component, ComponentPatch } from "@/features/diagram";
import { OutlineControl } from "./OutlineControl";
import { buildOutlineSections } from "./outlineSections";

const t = (key: string) => key;
const comp = (extra: Record<string, unknown>): Component =>
  ({ id: "x", name: "x", description: "", parentId: null, ...extra }) as unknown as Component;

function sectionsFor(component: Component) {
  const update = vi.fn<(id: string, patch: ComponentPatch) => void>();
  return { sections: buildOutlineSections(component, undefined, update, t), update };
}

describe("buildOutlineSections", () => {
  it("offers a boundary its border style and writes it", () => {
    const { sections, update } = sectionsFor(comp({ type: "panel", panelKind: "default" }));
    expect(sections.map((s) => s.label)).toEqual(["elementPanel.border"]);
    expect(sections[0].options.map((o) => o.value)).toEqual(["solid", "dashed", "dotted"]);
    sections[0].onChange("dotted");
    expect(update).toHaveBeenCalledWith("x", { borderStyle: "dotted" });
  });

  it("offers a lane solid or dashed, storing solid as nothing", () => {
    const { sections, update } = sectionsFor(
      comp({ type: "panel", panelKind: "swimlane", borderStyle: "dashed" }),
    );
    expect(sections[0].value).toBe("dashed");
    sections[0].onChange("solid");
    expect(update).toHaveBeenCalledWith("x", { borderStyle: undefined });
  });

  it("offers a flow element fill and stroke, storing the defaults as nothing", () => {
    const { sections, update } = sectionsFor(comp({ type: "process-node", flowShape: "process" }));
    expect(sections.map((s) => s.label)).toEqual(["elementPanel.fill", "elementPanel.stroke"]);
    sections[0].onChange("soft");
    expect(update).toHaveBeenLastCalledWith("x", { fill: "soft" });
    sections[0].onChange("none");
    expect(update).toHaveBeenLastCalledWith("x", { fill: undefined });
    sections[1].onChange("dashed");
    expect(update).toHaveBeenLastCalledWith("x", { stroke: "dashed" });
    sections[1].onChange("solid");
    expect(update).toHaveBeenLastCalledWith("x", { stroke: undefined });
  });

  it("turns a legacy node colour into the accent when a fill is chosen", () => {
    const { sections, update } = sectionsFor(
      comp({ type: "process-node", flowShape: "process", nodeColor: "#ff0000" }),
    );
    sections[0].onChange("none");
    expect(update).toHaveBeenLastCalledWith("x", {
      fill: undefined,
      customColor: "#ff0000",
      nodeColor: undefined,
    });
  });

  it("offers nothing to an element with no outline to style", () => {
    expect(sectionsFor(comp({ type: "system" })).sections).toEqual([]);
  });
});

describe("OutlineControl", () => {
  it("opens on click and reports the choice", () => {
    const onChange = vi.fn();
    render(
      <OutlineControl
        label="Border"
        sections={[
          {
            label: "Style",
            value: "solid",
            options: [
              { value: "solid", label: "Solid" },
              { value: "dashed", label: "Dashed" },
            ],
            onChange,
          },
        ]}
      />,
    );
    expect(screen.queryByRole("radio", { name: "Dashed" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Border" }));
    expect(screen.getByRole("radio", { name: "Solid" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("radio", { name: "Dashed" }));
    expect(onChange).toHaveBeenCalledWith("dashed");
  });
});
