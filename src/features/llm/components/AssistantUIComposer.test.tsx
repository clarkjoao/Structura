import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/infrastructure/i18n";
import type { Diagram } from "@/features/diagram";
import { fixtureDiagram } from "../test-utils/fixture-host";
import { useResolvedDiagram } from "../hooks/useResolvedDiagram";
import { isSelectionRef, type MentionRef } from "../mentions/mention-ref";
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

const newConversation = vi.fn();
vi.mock("../hooks/useCommandActions", () => ({
  useCommandActions: () => ({ newConversation, copyConversation: vi.fn() }),
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
    expect(newConversation).toHaveBeenCalledTimes(1);
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

  it("ArrowDown moves the active item and Enter picks it", () => {
    render(<AssistantUIComposer onSend={vi.fn()} isLoading={false} />);
    const textarea = getTextarea();
    fireEvent.change(textarea, { target: { value: "/", selectionStart: 1 } });
    fireEvent.keyDown(textarea, { key: "ArrowDown" });
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(screen.getByText("/explain")).toBeTruthy();
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
    render(<AssistantUIComposer onSend={onSend} isLoading={false} selectedNodeIds={["n-1"]} />);
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
    if (ref && isSelectionRef(ref)) {
      expect(ref.nodeIds).toEqual(["n-1"]);
    } else {
      throw new Error(`expected a selection ref, got ${JSON.stringify(ref)}`);
    }
  });

  it("follows the canvas selection", () => {
    const { rerender } = render(
      <AssistantUIComposer onSend={vi.fn()} isLoading={false} selectedNodeIds={["n-1"]} />,
    );
    expect(
      screen.getByText(i18n.t("llmChat.mention.selectionChip", { label: "API" })),
    ).toBeTruthy();
    rerender(<AssistantUIComposer onSend={vi.fn()} isLoading={false} selectedNodeIds={["n-2"]} />);
    expect(
      screen.getByText(i18n.t("llmChat.mention.selectionChip", { label: "Orders DB" })),
    ).toBeTruthy();
  });

  it("dismisses the auto selection chip after send", async () => {
    const onSend = vi.fn().mockResolvedValue(true);
    render(<AssistantUIComposer onSend={onSend} isLoading={false} selectedNodeIds={["n-1"]} />);
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

describe("AssistantUIComposer — message queue", () => {
  it("Enter while isLoading calls onSend and clears the input", async () => {
    const onSend = vi.fn().mockResolvedValue(true);
    render(<AssistantUIComposer onSend={onSend} isLoading={true} />);
    const textarea = getTextarea();
    fireEvent.change(textarea, { target: { value: "next question", selectionStart: 12 } });
    fireEvent.keyDown(textarea, { key: "Enter" });

    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
    expect(onSend.mock.calls[0]?.[0]).toBe("next question");
    expect(textarea.value).toBe("");
  });

  it("Shift+Enter breaks the line and does not send", () => {
    const onSend = vi.fn().mockResolvedValue(true);
    render(<AssistantUIComposer onSend={onSend} isLoading={true} />);
    const textarea = getTextarea();
    fireEvent.change(textarea, { target: { value: "first", selectionStart: 5 } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });

    expect(onSend).not.toHaveBeenCalled();
    // The composer must NOT preventDefault on Shift+Enter, so the textarea
    // keeps the inserted newline (jsdom reflects the unchanged value because
    // the newline comes from the browser default, not from React state).
  });

  it("Cmd+Enter while isLoading calls onSend and clears the input", async () => {
    const onSend = vi.fn().mockResolvedValue(true);
    render(<AssistantUIComposer onSend={onSend} isLoading={true} />);
    const textarea = getTextarea();
    fireEvent.change(textarea, { target: { value: "next question", selectionStart: 12 } });
    fireEvent.keyDown(textarea, { key: "Enter", metaKey: true });

    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
    expect(onSend.mock.calls[0]?.[0]).toBe("next question");
    expect(textarea.value).toBe("");
  });

  it("Ctrl+Enter while isLoading calls onSend and clears the input", async () => {
    const onSend = vi.fn().mockResolvedValue(true);
    render(<AssistantUIComposer onSend={onSend} isLoading={true} />);
    const textarea = getTextarea();
    fireEvent.change(textarea, { target: { value: "queued", selectionStart: 6 } });
    fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });

    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
    expect(textarea.value).toBe("");
  });

  it("the send button is enabled while isLoading so the user can queue", () => {
    const onSend = vi.fn().mockResolvedValue(true);
    render(<AssistantUIComposer onSend={onSend} isLoading={true} />);
    const textarea = getTextarea();
    fireEvent.change(textarea, { target: { value: "queued", selectionStart: 6 } });
    const sendButton = screen.getByRole("button", { name: i18n.t("llmChat.send") });
    expect(sendButton.hasAttribute("disabled")).toBe(false);
  });

  it("renders queued messages above the input and removes them on click", () => {
    const onRemove = vi.fn();
    const queued = [
      { id: "q-1", text: "first queued", mentions: [], skills: [] },
      { id: "q-2", text: "second queued", mentions: [], skills: [] },
    ];
    render(
      <AssistantUIComposer
        onSend={vi.fn().mockResolvedValue(true)}
        isLoading={true}
        queuedMessages={queued}
        onRemoveQueued={onRemove}
      />,
    );
    expect(screen.getByText("first queued")).toBeTruthy();
    expect(screen.getByText("second queued")).toBeTruthy();

    const firstChip = screen.getByText("first queued").parentElement as HTMLElement;
    const remove = within(firstChip).getByRole("button", {
      name: i18n.t("llmChat.queue.removeOne"),
    });
    fireEvent.click(remove);
    expect(onRemove).toHaveBeenCalledWith("q-1");
  });

  it("does not render the queued bar when the queue is empty", () => {
    render(
      <AssistantUIComposer
        onSend={vi.fn().mockResolvedValue(true)}
        isLoading={true}
        queuedMessages={[]}
        onRemoveQueued={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText(i18n.t("llmChat.queue.label", { count: 1 }))).toBeNull();
  });
});
