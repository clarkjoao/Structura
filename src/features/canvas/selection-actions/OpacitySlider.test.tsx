import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OpacitySlider } from "./OpacitySlider";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("OpacitySlider", () => {
  it("renders with the given value", () => {
    const onChange = vi.fn();
    render(<OpacitySlider value={50} onChange={onChange} />);
    const input = screen.getByRole("slider") as HTMLInputElement;
    expect(input.value).toBe("50");
  });

  it("calls onChange when slider value changes", () => {
    const onChange = vi.fn();
    render(<OpacitySlider value={0} onChange={onChange} />);
    const input = screen.getByRole("slider");
    fireEvent.change(input, { target: { value: "75" } });
    expect(onChange).toHaveBeenCalledWith(75);
  });

  it("displays the numeric value next to the slider", () => {
    const onChange = vi.fn();
    render(<OpacitySlider value={100} onChange={onChange} />);
    expect(screen.getByText("100")).toBeInTheDocument();
  });
});
