import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/infrastructure/i18n";
import { EmbedPreview } from "./EmbedPreview";
import { BLOCKED, LOAD_GRAPH, PROBE, PROBE_RESULT, SEARCH, postToHost } from "./protocol";

vi.mock("./protocol", async (original) => ({
  ...(await original<typeof import("./protocol")>()),
  postToHost: vi.fn(),
}));

/** React Flow draws nothing in jsdom without measurement. */
beforeAll(() => {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    private readonly cb: (entries: unknown[], self: unknown) => void;
    constructor(cb: (entries: unknown[], self: unknown) => void) {
      this.cb = cb;
    }
    observe(element: Element): void {
      this.cb([{ target: element, contentRect: { width: 200, height: 100 } }], this);
    }
    unobserve(): void {}
    disconnect(): void {}
  };
  (globalThis as unknown as { DOMMatrixReadOnly: unknown }).DOMMatrixReadOnly = class {
    m22 = 1;
  };
});

beforeEach(async () => {
  await i18n.changeLanguage("en");
  vi.mocked(postToHost).mockClear();
});

const send = (data: object) =>
  act(() => {
    window.dispatchEvent(new MessageEvent("message", { data }));
  });

const graph = {
  type: LOAD_GRAPH,
  components: [{ key: "a", name: "orders", type: "container", x: 0, y: 0 }],
  connections: [],
};
const blocked = { type: BLOCKED, reason: "errors", errors: 1, problems: [] };
const searchInput = () => document.querySelector(".viewer-canvas input");

describe("EmbedPreview", () => {
  it("does not open the search later for a request made before there was a diagram", async () => {
    render(<EmbedPreview />, { wrapper: MemoryRouter });
    await send(blocked);
    await send({ type: SEARCH });
    await send(graph);
    expect(await screen.findByText("orders")).toBeTruthy();
    expect(searchInput()).toBeNull();
  });

  it("takes focus back when the search is requested again while open", async () => {
    render(<EmbedPreview />, { wrapper: MemoryRouter });
    await send(graph);
    await send({ type: SEARCH });
    const input = searchInput() as HTMLInputElement;
    expect(document.activeElement).toBe(input);
    input.blur();
    await send({ type: SEARCH });
    expect(document.activeElement).toBe(input);
  });

  it("reports the errors view as blocked, with or without a diagram", async () => {
    render(<EmbedPreview />, { wrapper: MemoryRouter });
    await send(blocked);
    expect(screen.getByText("The YAML has 1 opscr error")).toBeTruthy();
    await send({ type: PROBE });
    expect(postToHost).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: PROBE_RESULT, blocked: true }),
    );
    await send(graph);
    await send({ ...blocked, errors: 2 });
    expect(screen.getByText("Not updated: 2 opscr errors — see Problems")).toBeTruthy();
    await send({ type: PROBE });
    expect(postToHost).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: PROBE_RESULT, blocked: true }),
    );
  });
});
