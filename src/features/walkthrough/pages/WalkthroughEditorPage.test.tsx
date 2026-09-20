import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import i18n from "@/infrastructure/i18n";
import { useDiagramStore } from "@/features/diagram";
import { useWalkthroughStore } from "../store/walkthrough.store";
import type { WalkthroughPresentation } from "../model/walkthrough.types";
import WalkthroughEditorPage from "./WalkthroughEditorPage";

vi.mock("../persistence/walkthroughFileSync", () => ({
  startWalkthroughFileSync: vi.fn(async () => {}),
  stopWalkthroughFileSync: vi.fn(),
  flushWalkthroughFileSync: vi.fn(async () => {}),
}));

function wt(over: Partial<WalkthroughPresentation> = {}): WalkthroughPresentation {
  return {
    id: "wt_1",
    title: "Tour",
    steps: [],
    createdAt: 0,
    updatedAt: 100,
    folderId: null,
    ...over,
  };
}

function mount(presentation = wt()) {
  useWalkthroughStore.setState({
    presentations: { [presentation.id]: presentation },
    hydrated: true,
  });
  useDiagramStore.setState({ diagrams: {} } as never);

  return render(
    <MemoryRouter initialEntries={[`/walkthrough/${presentation.id}/edit`]}>
      <Routes>
        <Route path="/walkthrough/:id/edit" element={<WalkthroughEditorPage />} />
        <Route path="/walkthroughs" element={<div data-testid="library">library</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const stored = (id = "wt_1") => useWalkthroughStore.getState().presentations[id];

beforeEach(async () => {
  await i18n.changeLanguage("en");
  localStorage.clear();
});

describe("autosave", () => {
  it("writes a change without being asked", async () => {
    mount();

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Renamed" } });

    await waitFor(() => expect(stored().title).toBe("Renamed"));
  });

  it("keeps the change when the editor is left before the debounce fires", async () => {
    const { unmount } = mount();

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Left in a hurry" } });
    // No waiting: leave while the debounce is still in flight, which is what
    // used to discard the edit silently.
    unmount();

    await waitFor(() => expect(stored().title).toBe("Left in a hurry"));
  });

  it("does not write merely because a walkthrough was opened", async () => {
    mount();
    const before = stored().updatedAt;

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(stored().updatedAt).toBe(before);
  });
});

describe("description and author notes", () => {
  it("lets the description be edited, and the library sees it", async () => {
    mount();

    fireEvent.click(screen.getByText(/What is this walkthrough about/));
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "covers the checkout path" },
    });

    await waitFor(() => expect(stored().description).toBe("covers the checkout path"));
  });

  it("lets author notes be edited", async () => {
    mount();

    fireEvent.click(screen.getByText(/What is this walkthrough about/));
    fireEvent.change(screen.getByLabelText(/Author notes/), {
      target: { value: "mention the retry" },
    });

    await waitFor(() => expect(stored().authorNotes).toBe("mention the retry"));
  });

  it("shows an existing description without opening the panel", () => {
    mount(wt({ description: "already written" }));

    expect(screen.getByText("already written")).toBeTruthy();
  });
});
