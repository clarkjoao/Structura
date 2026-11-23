import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { listDiagramKinds } from "@/features/diagram-kinds/registry";
import { AddDiagramDialog } from "./AddDiagramDialog";

/** With no kind registered, the dialog is the one it was before kinds existed. */
describe("AddDiagramDialog — no kinds registered", () => {
  it("offers no kind choice", () => {
    expect(listDiagramKinds()).toEqual([]);
    render(<AddDiagramDialog onClose={() => {}} onAdd={() => {}} />);
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });
});
