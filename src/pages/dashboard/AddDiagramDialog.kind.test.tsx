import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { registerBuiltInDiagramKinds } from "@/features/diagram-kinds/bootstrap";
import { AddDiagramDialog } from "./AddDiagramDialog";

registerBuiltInDiagramKinds();

function fillName(name: string) {
  fireEvent.change(screen.getAllByRole("textbox")[0]!, { target: { value: name } });
}

describe("AddDiagramDialog — diagram kind", () => {
  it("offers Freehand preselected and creates freehand by default", () => {
    const onAdd = vi.fn();
    render(<AddDiagramDialog onClose={() => {}} onAdd={onAdd} />);
    const radios = screen.getAllByRole("radio");
    expect(radios[0]).toHaveAttribute("aria-checked", "true");
    expect(radios.map((r) => r.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Freehand|Livre/),
        expect.stringMatching(/Guided|Guiado/),
      ]),
    );
    fillName("Checkout");
    fireEvent.click(screen.getByRole("button", { name: /create|criar/i }));
    expect(onAdd).toHaveBeenCalledWith("Checkout", "context", undefined, undefined, null);
  });

  it("passes the chosen kind", () => {
    const onAdd = vi.fn();
    render(<AddDiagramDialog onClose={() => {}} onAdd={onAdd} />);
    fireEvent.click(screen.getByRole("radio", { name: /Guided|Guiado/ }));
    fillName("Checkout");
    fireEvent.click(screen.getByRole("button", { name: /create|criar/i }));
    expect(onAdd).toHaveBeenCalledWith("Checkout", "context", undefined, undefined, "guided", {
      direction: "LR",
    });
  });

  it("offers the direction for a guided diagram and passes Vertical", () => {
    const onAdd = vi.fn();
    render(<AddDiagramDialog onClose={() => {}} onAdd={onAdd} />);
    expect(screen.queryByTestId("direction-choice-TB")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: /Guided|Guiado/ }));
    fireEvent.click(screen.getByTestId("direction-choice-TB"));
    fillName("Checkout");
    fireEvent.click(screen.getByRole("button", { name: /create|criar/i }));
    expect(onAdd).toHaveBeenCalledWith("Checkout", "context", undefined, undefined, "guided", {
      direction: "TB",
    });
  });

  it("offers the guided templates and meeting notes", () => {
    const onAdd = vi.fn();
    render(<AddDiagramDialog onClose={() => {}} onAdd={onAdd} />);
    fireEvent.click(screen.getByRole("radio", { name: /Guided|Guiado/ }));
    fireEvent.click(screen.getByTestId("template-choice-checkout"));
    fillName("Loja");
    fireEvent.click(screen.getByRole("button", { name: /create|criar/i }));
    expect(onAdd).toHaveBeenLastCalledWith("Loja", "context", undefined, undefined, "guided", {
      direction: "LR",
      templateId: "checkout",
    });
    fireEvent.click(screen.getByTestId("template-choice-notes"));
    fireEvent.change(screen.getByTestId("template-notes"), { target: { value: "Cliente paga" } });
    fireEvent.click(screen.getByRole("button", { name: /create|criar/i }));
    expect(onAdd).toHaveBeenLastCalledWith("Loja", "context", undefined, undefined, "guided", {
      direction: "LR",
      notes: "Cliente paga",
    });
  });
});
