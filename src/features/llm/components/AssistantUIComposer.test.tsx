import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/infrastructure/i18n";
import type { Diagram } from "@/features/diagram";
import { fixtureDiagram } from "../test-utils/fixture-host";
import { useResolvedDiagram } from "../hooks/useResolvedDiagram";
import type { MentionRef } from "../mentions/mention-ref";
import type { CommandRef } from "../types";
import { AssistantUIComposer } from "./AssistantUIComposer";

/** cmdk's `CommandList` measures its own size; jsdom has no ResizeObserver. */
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  }
});

const diagram = fixtureDiagram({
  "n-1": { id: "n-1", type: "container", name: "API", description: "", parentId: null },
  "n-2": { id: "n-2", type: "container", name: "Orders DB", description: "", parentId: null },
}) as Diagram;

vi.mock("../hooks/useResolvedDiagram", () => ({
  useResolvedDiagram: vi.fn(),
}));

const useResolvedDiagramMock = vi.mocked(useResolvedDiagram);

beforeEach(() => {
  useResolvedDiagramMock.mockReturnValue(diagram);
});

afterEach(() => {
  vi.clearAllMocks();
});

function getTextarea(): HTMLTextAreaElement {
  return screen.getByRole("textbox", { name: i18n.t("llmChat.inputLabel") }) as HTMLTextAreaElement;
}

function pickFirstMenuItem(): void {
  // The first item in the menu is the active one by default; Enter picks it.
  const textarea = getTextarea();
  fireEvent.keyDown(textarea, { key: "Enter" });
}

describe("AssistantUIComposer — @ mention menu", () => {
  it("opens the mention menu when @ is typed and exposes the listbox", () => {
    render(<AssistantUIComposer onSend={vi.fn()} isLoading={false} />);
    const textarea = getTextarea();
    fireEvent.change(textarea, { target: { value: "@", selectionStart: 1 } });
    expect(textarea.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("listbox")).toBeTruthy();
  });

  it("adds a node chip and clears the @query text when a mention is chosen", () => {
    const onSend = vi.fn().mockResolvedValue(true);
    render(<AssistantUIComposer onSend={onSend} isLoading={false} />);
    const textarea = getTextarea();
    fireEvent.change(textarea, { target: { value: "@AP", selectionStart: 3 } });
    pickFirstMenuItem();
    expect(screen.getByText("@API")).toBeTruthy();
    expect(textarea.value).toBe("");
  });
});

describe("AssistantUIComposer — / command menu", () => {
  it("opens the command menu with the six built-in commands at the start of the message", () => {
    render(<AssistantUIComposer onSend={vi.fn()} isLoading={false} />);
    const textarea = getTextarea();
    fireEvent.change(textarea, { target: { value: "/", selectionStart: 1 } });
    const listbox = screen.getByRole("listbox");
    const text = listbox.textContent ?? "";
    for (const name of ["/review", "/explain", "/well-arch", "/blast-radius", "/clear", "/copy"]) {
      expect(text).toContain(name);
    }
  });

  it("picking /review sets a /name chip and clears the trigger", () => {
    const onSend = vi.fn().mockResolvedValue(true);
    render(<AssistantUIComposer onSend={onSend} isLoading={false} />);
    const textarea = getTextarea();
    fireEvent.change(textarea, { target: { value: "/", selectionStart: 1 } });
    pickFirstMenuItem();
    expect(textarea.value).toBe("");
    expect(screen.getByText("/review")).toBeTruthy();
  });

  it("picking /clear runs the action and adds no chip", () => {
    const onSend = vi.fn().mockResolvedValue(true);
    render(<AssistantUIComposer onSend={onSend} isLoading={false} />);
    const textarea = getTextarea();
    fireEvent.change(textarea, { target: { value: "/cl", selectionStart: 3 } });
    pickFirstMenuItem();
    // /clear is an action; no chip is added.
    expect(screen.queryByText("/clear")).toBeNull();
  });
});

describe("AssistantUIComposer — keyboard", () => {
  it("Esc closes the menu without changing the text", () => {
    render(<AssistantUIComposer onSend={vi.fn()} isLoading={false} />);
    const textarea = getTextarea();
    fireEvent.change(textarea, { target: { value: "@", selectionStart: 1 } });
    expect(textarea.getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(textarea, { key: "Escape" });
    expect(textarea.getAttribute("aria-expanded")).toBe("false");
    expect(textarea.value).toBe("@");
  });

  it("Backspace in an empty textarea removes the last mention chip", () => {
    const onSend = vi.fn().mockResolvedValue(true);
    render(<AssistantUIComposer onSend={onSend} isLoading={false} />);
    const textarea = getTextarea();
    fireEvent.change(textarea, { target: { value: "@AP", selectionStart: 3 } });
    pickFirstMenuItem();
    expect(screen.getByText("@API")).toBeTruthy();
    expect(textarea.value).toBe("");
    fireEvent.keyDown(textarea, { key: "Backspace" });
    expect(screen.queryByText("@API")).toBeNull();
  });
});

describe("AssistantUIComposer — selection chip and send", () => {
  it("shows a Selection chip and snapshots its ids on send", () => {
    const onSend = vi.fn().mockResolvedValue(true);
    render(
      <AssistantUIComposer
        onSend={onSend}
        isLoading={false}
        selectedNodeIds={["n-1"]}
      />,
    );
    expect(
      screen.getByText(i18n.t("llmChat.mention.selectionChip", { label: "API" })),
    ).toBeTruthy();
    const sendButton = screen.getByRole("button", { name: i18n.t("llmChat.send") });
    fireEvent.click(sendButton);

    expect(onSend).toHaveBeenCalledTimes(1);
    const [text, mentions] = onSend.mock.calls[0] as [string, MentionRef[], CommandRef?];
    expect(text).toBe("");
    const ref = mentions[0];
    expect(ref).toBeDefined();
    if (ref && ref.kind === "selection") {
      expect(ref.nodeIds).toEqual(["n-1"]);
    } else {
      throw new Error(`expected a selection ref, got ${JSON.stringify(ref)}`);
    }
  });

  it("dismisses the auto selection chip after send", async () => {
    const onSend = vi.fn().mockResolvedValue(true);
    render(
      <AssistantUIComposer
        onSend={onSend}
        isLoading={false}
        selectedNodeIds={["n-1"]}
      />,
    );
    const sendButton = screen.getByRole("button", { name: i18n.t("llmChat.send") });
    fireEvent.click(sendButton);
    // onSend resolves asynchronously, then the composer resets.
    await Promise.resolve();
    await Promise.resolve();
    expect(
      screen.queryByText(i18n.t("llmChat.mention.selectionChip", { label: "API" })),
    ).toBeNull();
  });
});

describe("AssistantUIComposer — send guard", () => {
  it("does not call onSend when the draft is empty and there are no chips", () => {
    const onSend = vi.fn().mockResolvedValue(true);
    render(<AssistantUIComposer onSend={onSend} isLoading={false} />);
    const sendButton = screen.getByRole("button", { name: i18n.t("llmChat.send") });
    expect(sendButton.hasAttribute("disabled")).toBe(true);
    fireEvent.click(sendButton);
    expect(onSend).not.toHaveBeenCalled();
  });
});

describe("AssistantUIComposer — chip remove", () => {
  it("the remove button on a mention chip drops it", () => {
    const onSend = vi.fn().mockResolvedValue(true);
    render(<AssistantUIComposer onSend={onSend} isLoading={false} />);
    const textarea = getTextarea();
    fireEvent.change(textarea, { target: { value: "@AP", selectionStart: 3 } });
    pickFirstMenuItem();
    const chip = screen.getByText("@API").parentElement as HTMLElement;
    const remove = within(chip).getByRole("button", {
      name: i18n.t("llmChat.mention.removeTag", { label: "API" }),
    });
    fireEvent.click(remove);
    expect(screen.queryByText("@API")).toBeNull();
  });
});
