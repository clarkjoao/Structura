import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  AssistantRuntimeProvider,
  MessagePrimitive,
  ThreadPrimitive,
  useExternalStoreRuntime,
  type ThreadMessage,
} from "@assistant-ui/react";
import i18n from "@/infrastructure/i18n";
import { MarkdownText } from "./MarkdownText";

function AssistantText({ text }: { text: string }) {
  const messages: ThreadMessage[] = [
    {
      id: "a-1",
      role: "assistant",
      content: [{ type: "text", text }],
      status: { type: "complete", reason: "stop" },
      createdAt: new Date(0),
      metadata: {
        unstable_state: null,
        unstable_annotations: [],
        unstable_data: [],
        steps: [],
        custom: {},
      },
    },
  ];
  const runtime = useExternalStoreRuntime({
    messages,
    isRunning: false,
    onNew: async () => {},
  });
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root>
        <ThreadPrimitive.Messages>
          {() => <MessagePrimitive.Parts components={{ Text: MarkdownText }} />}
        </ThreadPrimitive.Messages>
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}

describe("MarkdownText", () => {
  it("renders a GFM table inside a horizontally scrollable box", async () => {
    const { container } = render(
      <AssistantText text={"| Service | Port |\n| --- | --- |\n| api | 443 |"} />,
    );
    const table = await screen.findByRole("table");
    expect(table.parentElement?.className).toContain("overflow-x-auto");
    expect(screen.getByText("api")).toBeTruthy();
    expect(container.querySelector("th")?.textContent).toBe("Service");
  });

  it("renders fenced code in mono with a copy button", async () => {
    const { container } = render(<AssistantText text={"```ts\nconst port = 443;\n```"} />);
    await screen.findByText("const port = 443;");
    expect(container.querySelector("pre")?.className).toContain("font-mono");
    expect(screen.getByRole("button", { name: i18n.t("llmChat.markdown.copyCode") })).toBeTruthy();
  });

  it("styles inline code with the muted background", async () => {
    render(<AssistantText text={"Use `kubectl apply` here."} />);
    const code = await screen.findByText("kubectl apply");
    expect(code.tagName).toBe("CODE");
    expect(code.className).toContain("bg-muted");
  });

  it("opens links in a new tab without an opener", async () => {
    render(<AssistantText text={"See [the docs](https://example.com)."} />);
    const link = await screen.findByRole("link", { name: "the docs" });
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("shows raw HTML as text instead of rendering it", async () => {
    const { container } = render(
      <AssistantText text={'Before <img src="x" onerror="alert(1)"> after <b>bold</b>'} />,
    );
    await screen.findByText(/Before/);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(container.textContent).toContain('<img src="x" onerror="alert(1)">');
    expect(container.textContent).toContain("<b>");
  });
});
