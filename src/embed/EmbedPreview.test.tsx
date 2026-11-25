import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/infrastructure/i18n";
import { EmbedPreview } from "./EmbedPreview";
import {
  ARRANGE,
  BLOCKED,
  LOAD_GRAPH,
  OPEN,
  OPEN_PROBLEM,
  PROBE,
  PROBE_RESULT,
  REVEAL,
  SEARCH,
  SELECT,
  postToHost,
} from "./protocol";

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
    expect(screen.getByText("Not updated: 2 opscr errors — click to open the first")).toBeTruthy();
    await send({ type: PROBE });
    expect(postToHost).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: PROBE_RESULT, blocked: true }),
    );
  });

  it("asks the host to open a problem the reader clicks", async () => {
    render(<EmbedPreview />, { wrapper: MemoryRouter });
    await send({ ...blocked, errors: 2, problems: ["a.yaml:3 bad", "b.yaml:9 worse"] });
    await act(async () => screen.getByText("b.yaml:9 worse").click());
    expect(postToHost).toHaveBeenLastCalledWith({ type: OPEN_PROBLEM, index: 1 });
    await send(graph);
    await send(blocked);
    await act(async () =>
      screen.getByText("Not updated: 1 opscr error — click to open it").click(),
    );
    expect(postToHost).toHaveBeenLastCalledWith({ type: OPEN_PROBLEM, index: 0 });
  });

  it("tells the host which element was clicked, and lights the one the host selects", async () => {
    render(<EmbedPreview />, { wrapper: MemoryRouter });
    await send(graph);
    const node = await screen.findByText("orders");
    await act(async () => {
      node.click();
    });
    expect(postToHost).toHaveBeenCalledWith({
      type: REVEAL,
      element: { kind: "component", key: "a" },
    });

    await act(async () => {
      node.click(); // a second click drops the light
    });
    const selected = () => document.querySelector(".react-flow__node.selected");
    expect(selected()).toBeNull();
    await send({ type: SELECT, element: { kind: "component", key: "a" } });
    expect(selected()?.getAttribute("data-id")).toBe("a");
    await send({ type: SELECT, element: null });
    expect(selected()).toBeNull();
  });

  it("tells the host which element was double-clicked, so it can open what it stands for", async () => {
    render(<EmbedPreview />, { wrapper: MemoryRouter });
    await send(graph);
    const node = await screen.findByText("orders");
    await act(async () => {
      node.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });
    expect(postToHost).toHaveBeenCalledWith({
      type: OPEN,
      element: { kind: "component", key: "a" },
    });
  });

  it("arranges with the canvas rules when asked, and draws the host's positions otherwise", async () => {
    const names = ["a", "b", "c", "d", "e"];
    const chain = {
      type: LOAD_GRAPH,
      components: names.map((name, i) => ({ key: name, name, type: "system", x: i * 300, y: 0 })),
      connections: [
        ...names.slice(1).map((name, i) => ({ source: names[i], target: name, label: "calls" })),
        { source: "e", target: "a", label: "retries" },
      ],
    };
    const nodes = () => document.querySelectorAll(".react-flow__node").length;
    render(<EmbedPreview />, { wrapper: MemoryRouter });
    await send(chain);
    await screen.findByText("e");
    expect(nodes()).toBe(5);

    // The far loop ends on a reference beside its consumer, as on the canvas.
    await send({ type: ARRANGE, arrange: { mode: "automatic" } });
    await waitFor(() => expect(nodes()).toBe(6));

    await send({ type: ARRANGE, arrange: { mode: "automatic", settings: { references: "off" } } });
    await waitFor(() => expect(nodes()).toBe(5));
  });
});
