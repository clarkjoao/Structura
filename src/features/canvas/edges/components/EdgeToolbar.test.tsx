import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { EdgeStyle } from "@/features/diagram/enums";
import { getLastEdgeStyle, saveLastEdgeStyle } from "@/features/diagram/utils/edge-style";
import { kvGetItem, kvRemoveItem } from "@/infrastructure/persistence/kvStorage";
import { EdgeToolbar } from "./EdgeToolbar";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/features/canvas/selection-actions/FloatingSelectionToolbar", () => ({
  FloatingSelectionToolbar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/features/canvas/shared/RouteThroughRefButton", () => ({
  RouteThroughRefButton: () => null,
}));

describe("EdgeToolbar edge style memory", () => {
  beforeEach(() => {
    kvRemoveItem("structura:lastEdgeStyle");
  });

  it("persists the picked style, and the next new edge reads it back", async () => {
    const onStyleChange = vi.fn();
    render(
      <EdgeToolbar
        anchor={{ x: 0, y: 0 }}
        canReset={false}
        onReset={vi.fn()}
        onDelete={vi.fn()}
        edgeStyle={EdgeStyle.EditableStep}
        onStyleChange={onStyleChange}
        onColorChange={vi.fn()}
        onMarkerStartChange={vi.fn()}
        onMarkerEndChange={vi.fn()}
      />,
    );
    // New edges are created with getLastEdgeStyle(); default until the user picks one.
    expect(getLastEdgeStyle()).toBe(EdgeStyle.EditableStep);
    fireEvent.click(screen.getAllByRole("button")[0]!);
    fireEvent.click(await waitFor(() => screen.getByText(/common.edgeStraight/)));
    expect(onStyleChange).toHaveBeenCalledWith(EdgeStyle.Straight);
    expect(kvGetItem("structura:lastEdgeStyle")).toBe(EdgeStyle.Straight);
    expect(getLastEdgeStyle()).toBe(EdgeStyle.Straight);
  });

  it("round-trips every EdgeStyle value, including the editable ones", () => {
    for (const style of Object.values(EdgeStyle)) {
      saveLastEdgeStyle(style);
      expect(getLastEdgeStyle()).toBe(style);
    }
  });
});
