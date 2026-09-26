import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Component } from "@/features/diagram";
import i18n from "@/infrastructure/i18n";
import { VsmFieldsSection } from "./VsmFieldsSection";

const timeline = {
  id: "t",
  name: "Timeline",
  description: "",
  parentId: null,
  type: "vsm-timeline",
  unit: "d",
  segments: [
    { id: "a", wait: 5, process: 1 },
    { id: "b", wait: 2, process: 0.5 },
  ],
} as unknown as Component;

describe("the timeline's fields", () => {
  it("show totals computed from the segments", () => {
    render(<VsmFieldsSection component={timeline} onChange={vi.fn()} />);
    expect(screen.getByTestId("vsm-lead-time").textContent).toBe("8.5 d");
    expect(screen.getByTestId("vsm-value-added").textContent).toBe("1.5 d");
  });

  it("edit a segment without touching the totals, which are never stored", () => {
    const onChange = vi.fn();
    render(<VsmFieldsSection component={timeline} onChange={onChange} />);
    const waits = screen.getAllByLabelText(i18n.t("vsm.fields.wait"));
    fireEvent.change(waits[0], { target: { value: "7" } });
    const patch = onChange.mock.lastCall![0];
    expect(patch.segments[0]).toEqual({ id: "a", wait: 7, process: 1 });
    expect(Object.keys(patch)).toEqual(["segments"]);
  });

  it("store no unit for the default, minutes", () => {
    const onChange = vi.fn();
    render(<VsmFieldsSection component={timeline} onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: i18n.t("vsm.units.min") }));
    expect(onChange).toHaveBeenLastCalledWith({ unit: undefined });
  });
});
