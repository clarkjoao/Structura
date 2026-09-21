import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LibraryFilterToolbar } from "./LibraryFilterToolbar";

function renderToolbar(overrides: Partial<React.ComponentProps<typeof LibraryFilterToolbar>> = {}) {
  const props = {
    chips: [
      { value: "all", label: "All" },
      { value: "recent", label: "Recent" },
    ],
    activeChip: "all",
    onChipChange: vi.fn(),
    search: "",
    onSearchChange: vi.fn(),
    searchPlaceholder: "Search…",
    viewMode: "grid" as const,
    onViewModeChange: vi.fn(),
    sortOptions: [
      { key: "name", label: "Name" },
      { key: "sceneCount", label: "Scenes" },
    ],
    onSort: vi.fn(),
    ...overrides,
  } satisfies React.ComponentProps<typeof LibraryFilterToolbar>;
  return { ...render(<LibraryFilterToolbar {...props} />), props };
}

describe("LibraryFilterToolbar", () => {
  it("renders the caller's sort orderings and reports the chosen key", () => {
    const { props } = renderToolbar();

    // Radix opens its menu on pointerdown, not click.
    fireEvent.pointerDown(screen.getByText("Sort"), { button: 0, ctrlKey: false });
    // "Scenes" has no diagram counterpart — it exists only because the caller
    // supplied it, which is the point of the shared toolbar.
    fireEvent.click(screen.getByText("Scenes"));

    expect(props.onSort).toHaveBeenCalledWith("sceneCount");
  });

  it("renders only the chips the caller supplied", () => {
    renderToolbar();

    expect(screen.getByText("All")).toBeTruthy();
    expect(screen.getByText("Recent")).toBeTruthy();
    expect(screen.queryByText("Favorites")).toBeNull();
  });

  it("reports the chosen chip", () => {
    const { props } = renderToolbar();

    fireEvent.click(screen.getByText("Recent"));

    expect(props.onChipChange).toHaveBeenCalledWith("recent");
  });

  it("reports typing in the search box", () => {
    const { props } = renderToolbar();

    fireEvent.change(screen.getByPlaceholderText("Search…"), { target: { value: "auth" } });

    expect(props.onSearchChange).toHaveBeenCalledWith("auth");
  });

  it("reports a switch to the list view", () => {
    const { props } = renderToolbar();

    fireEvent.click(screen.getByLabelText("List view"));

    expect(props.onViewModeChange).toHaveBeenCalledWith("list");
  });
});
