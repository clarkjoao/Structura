import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import i18n from "@/infrastructure/i18n";
import type { ToolCallPart } from "@/features/llm/message-parts";
import { ToolCallGroup, ToolCallPartView, ToolCallRow } from "./ToolCallPart";

const search: ToolCallPart = {
  type: "tool-call",
  id: "c-1",
  name: "search_elements",
  source: "internal",
  args: { query: "redis" },
  status: "done",
  result: { hits: 2 },
};

const mcpCall: ToolCallPart = {
  type: "tool-call",
  id: "c-2",
  name: "create_issue",
  source: "mcp",
  serverId: "github",
  args: { title: "Cache" },
  status: "awaiting-approval",
};

describe("ToolCallRow", () => {
  it("shows the status label and the tool name in mono", () => {
    render(<ToolCallRow part={search} />);
    expect(screen.getByText(i18n.t("llmChat.toolCall.status.done"))).toBeTruthy();
    expect(screen.getByText("search_elements").className).toContain("font-mono");
  });

  it("expands to the arguments and the result", () => {
    render(<ToolCallRow part={search} />);
    expect(screen.queryByText(i18n.t("llmChat.toolCall.arguments"))).toBeNull();
    fireEvent.click(
      screen.getByRole("button", {
        name: i18n.t("llmChat.toolCall.showDetails", { name: "search_elements" }),
      }),
    );
    expect(screen.getByText(i18n.t("llmChat.toolCall.arguments"))).toBeTruthy();
    expect(screen.getByText(/"query": "redis"/)).toBeTruthy();
    expect(screen.getByText(/"hits": 2/)).toBeTruthy();
  });

  it("badges MCP calls with their server and shows the approval state", () => {
    render(<ToolCallRow part={mcpCall} />);
    expect(
      screen.getByText(i18n.t("llmChat.toolCall.mcpBadge", { server: "github" })),
    ).toBeTruthy();
    expect(screen.getByText(i18n.t("llmChat.toolCall.status.awaitingApproval"))).toBeTruthy();
  });

  it("shows the error of a failed call", () => {
    render(<ToolCallRow part={{ ...search, status: "error", result: undefined, error: "boom" }} />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("boom")).toBeTruthy();
  });
});

describe("ToolCallGroup", () => {
  it("renders consecutive calls in one bordered box", () => {
    const { container } = render(
      <ToolCallGroup>
        <ToolCallRow part={search} />
        <ToolCallRow part={mcpCall} />
      </ToolCallGroup>,
    );
    const group = container.firstElementChild as HTMLElement;
    expect(group.className).toContain("border");
    expect(within(group).getAllByTestId("tool-call-row")).toHaveLength(2);
  });
});

describe("ToolCallPartView", () => {
  it("renders the Structura part carried as the artifact and nothing otherwise", () => {
    const { rerender, container } = render(<ToolCallPartView artifact={search} />);
    expect(screen.getByText("search_elements")).toBeTruthy();
    rerender(<ToolCallPartView artifact={{ name: "x" }} />);
    expect(container.textContent).toBe("");
  });
});
