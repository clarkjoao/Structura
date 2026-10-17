import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import i18n from "@/infrastructure/i18n";
import type { QueuedMessage } from "@/features/llm/types";
import { QueuedMessagesBar } from "./QueuedMessagesBar";

function queue(items: Array<Partial<QueuedMessage> & { id: string }>): QueuedMessage[] {
  return items.map((item) => ({
    text: item.text ?? "",
    mentions: item.mentions ?? [],
    skills: item.skills ?? [],
    ...item,
  }));
}

describe("QueuedMessagesBar", () => {
  it("renders nothing when the queue is empty", () => {
    const { container } = render(<QueuedMessagesBar messages={[]} onRemove={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a pluralized label and one chip per message", () => {
    render(
      <QueuedMessagesBar
        messages={queue([
          { id: "q-1", text: "first" },
          { id: "q-2", text: "second" },
          { id: "q-3", text: "third" },
        ])}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText(i18n.t("llmChat.queue.label", { count: 3 }))).toBeTruthy();
    expect(screen.getByText("first")).toBeTruthy();
    expect(screen.getByText("second")).toBeTruthy();
    expect(screen.getByText("third")).toBeTruthy();
  });

  it("truncates a long preview with an ellipsis", () => {
    render(
      <QueuedMessagesBar
        messages={queue([{ id: "q-1", text: "a".repeat(80) }])}
        onRemove={vi.fn()}
      />,
    );
    const preview = screen.getByText(/a+…$/);
    expect(preview.textContent?.length).toBeLessThanOrEqual(30);
  });

  it("calls onRemove with the chip's id when the X is clicked", () => {
    const onRemove = vi.fn();
    render(
      <QueuedMessagesBar
        messages={queue([
          { id: "q-1", text: "first" },
          { id: "q-2", text: "second" },
        ])}
        onRemove={onRemove}
      />,
    );
    const firstChip = screen.getByText("first").parentElement as HTMLElement;
    const remove = within(firstChip).getByRole("button", {
      name: i18n.t("llmChat.queue.removeOne"),
    });
    fireEvent.click(remove);
    expect(onRemove).toHaveBeenCalledWith("q-1");
  });

  it("uses the attachment-only placeholder when the text is empty", () => {
    render(<QueuedMessagesBar messages={queue([{ id: "q-1", text: "" }])} onRemove={vi.fn()} />);
    expect(screen.getByText(i18n.t("llmChat.queue.attachmentOnly"))).toBeTruthy();
  });
});
