import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DIAGRAM_DRAG_MIME, WALKTHROUGH_DRAG_MIME } from "@/components/folders/dragTypes";
import type { Folder } from "@/features/diagram";
import type { WalkthroughPresentation } from "../model/walkthrough.types";
import { WalkthroughCard } from "./WalkthroughCard";
import { WalkthroughList } from "./WalkthroughList";
import { AddWalkthroughDialog } from "./AddWalkthroughDialog";

vi.mock("@/features/diagram", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/diagram")>()),
  useDiagramStore: (selector: (s: { diagrams: Record<string, unknown> }) => unknown) =>
    selector({ diagrams: {} }),
  useAllFolders: () => [] as Folder[],
  useFolders: () => ({}) as Record<string, Folder>,
}));

function wt(over: Partial<WalkthroughPresentation> = {}): WalkthroughPresentation {
  return {
    id: "wt_1",
    title: "Onboarding",
    steps: [],
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

function renderCard(over: Partial<React.ComponentProps<typeof WalkthroughCard>> = {}) {
  const props: React.ComponentProps<typeof WalkthroughCard> = {
    presentation: wt(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    isFavorite: false,
    onToggleFavorite: vi.fn(),
    ...over,
  };
  return {
    ...render(
      <MemoryRouter>
        <WalkthroughCard {...props} />
      </MemoryRouter>,
    ),
    props,
  };
}

describe("WalkthroughCard", () => {
  it("shows the description the library was given", () => {
    renderCard({ presentation: wt({ description: "covers the checkout path" }) });

    expect(screen.getByText("covers the checkout path")).toBeTruthy();
  });

  it("reports a favorite toggle without opening the walkthrough", () => {
    const { props } = renderCard();

    fireEvent.click(screen.getByTitle("Favorite"));

    expect(props.onToggleFavorite).toHaveBeenCalledWith("wt_1");
    expect(props.onEdit).not.toHaveBeenCalled();
  });

  it("shows a marked card as marked", () => {
    renderCard({ isFavorite: true });

    expect(screen.getByTitle("Favorite").getAttribute("aria-pressed")).toBe("true");
  });

  it("carries its id on the walkthrough drag type, not the diagram one", () => {
    renderCard();
    const setData = vi.fn();

    fireEvent.dragStart(screen.getByText("Onboarding").closest('[role="button"]') as HTMLElement, {
      dataTransfer: { setData, effectAllowed: "" },
    });

    expect(setData).toHaveBeenCalledWith(WALKTHROUGH_DRAG_MIME, "wt_1");
    expect(setData).not.toHaveBeenCalledWith(DIAGRAM_DRAG_MIME, expect.anything());
  });
});

describe("WalkthroughList", () => {
  const ITEMS = [wt({ id: "wt_1", title: "Onboarding" }), wt({ id: "wt_2", title: "Billing" })];

  function renderList(over: Partial<React.ComponentProps<typeof WalkthroughList>> = {}) {
    const props: React.ComponentProps<typeof WalkthroughList> = {
      items: ITEMS,
      folders: {},
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      favoriteIds: new Set<string>(),
      onToggleFavorite: vi.fn(),
      ...over,
    };
    return {
      ...render(
        <MemoryRouter>
          <WalkthroughList {...props} />
        </MemoryRouter>,
      ),
      props,
    };
  }

  it("shows every walkthrough the grid would have shown", () => {
    renderList();

    // The page hands both presentations the same array, so a reader switching
    // views must not lose one.
    expect(screen.getByText("Onboarding")).toBeTruthy();
    expect(screen.getByText("Billing")).toBeTruthy();
  });

  it("reports a favorite toggle from a row", () => {
    const { props } = renderList();

    fireEvent.click(screen.getAllByTitle("Favorite")[1]);

    expect(props.onToggleFavorite).toHaveBeenCalledWith("wt_2");
  });

  it("files by dragging a row, on the walkthrough drag type", () => {
    renderList();
    const setData = vi.fn();

    fireEvent.dragStart(screen.getByText("Billing").closest('[role="button"]') as HTMLElement, {
      dataTransfer: { setData, effectAllowed: "" },
    });

    expect(setData).toHaveBeenCalledWith(WALKTHROUGH_DRAG_MIME, "wt_2");
  });
});

describe("AddWalkthroughDialog", () => {
  it("passes the description through to the created walkthrough", () => {
    const onCreate = vi.fn();
    render(<AddWalkthroughDialog onClose={vi.fn()} onCreate={onCreate} folderId={null} />);

    fireEvent.change(screen.getByPlaceholderText(/Onboarding flow/), {
      target: { value: "Checkout" },
    });
    fireEvent.change(screen.getByLabelText(/Description/), {
      target: { value: "covers the checkout path" },
    });
    fireEvent.click(screen.getByText("Create walkthrough"));

    expect(onCreate).toHaveBeenCalledWith({
      title: "Checkout",
      description: "covers the checkout path",
      folderId: null,
    });
  });

  it("leaves the description out when it was not filled in", () => {
    const onCreate = vi.fn();
    render(<AddWalkthroughDialog onClose={vi.fn()} onCreate={onCreate} folderId={null} />);

    fireEvent.change(screen.getByPlaceholderText(/Onboarding flow/), {
      target: { value: "Checkout" },
    });
    fireEvent.click(screen.getByText("Create walkthrough"));

    expect(onCreate).toHaveBeenCalledWith({
      title: "Checkout",
      description: undefined,
      folderId: null,
    });
  });
});
