import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/infrastructure/i18n";
import type { Diagram } from "@/features/diagram";
import { fixtureDiagram } from "../test-utils/fixture-host";
import { useResolvedDiagram } from "../hooks/useResolvedDiagram";
import { useSkillStore } from "../skills/skill-store";
import type { Skill } from "../skills/skill.types";
import { AssistantUIComposer } from "./AssistantUIComposer";

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

vi.mock("../hooks/useResolvedDiagram", () => ({ useResolvedDiagram: vi.fn() }));
vi.mock("../hooks/useCommandActions", () => ({
  useCommandActions: () => ({ newConversation: vi.fn(), copyConversation: vi.fn() }),
}));

const aws: Skill = {
  id: ".structura/skills/aws.md",
  path: ".structura/skills/aws.md",
  source: "workspace",
  name: "AWS review",
  description: "Review AWS diagrams",
  instructions: "Use the pillars.",
  tools: ["get_node_details", "search_elements"],
  enabled: true,
};
const local: Skill = {
  id: "local-1",
  source: "local",
  name: "Tone",
  description: "Short answers",
  instructions: "Be brief.",
  enabled: true,
};
const disabled: Skill = { ...local, id: "local-2", name: "Hidden", enabled: false };

beforeEach(() => {
  vi.mocked(useResolvedDiagram).mockReturnValue(
    fixtureDiagram({
      api: { id: "api", type: "container", name: "API", description: "", parentId: null },
    }) as Diagram,
  );
  useSkillStore.setState({ skills: [aws, local, disabled], loaded: true });
});

afterEach(() => {
  vi.clearAllMocks();
  useSkillStore.setState({ skills: [], loaded: false });
});

function textarea(): HTMLTextAreaElement {
  return screen.getByRole("textbox", { name: i18n.t("llmChat.inputLabel") }) as HTMLTextAreaElement;
}

function type(value: string): void {
  fireEvent.change(textarea(), { target: { value, selectionStart: value.length } });
}

async function sendText(value: string): Promise<void> {
  type(value);
  await act(async () => {
    fireEvent.keyDown(textarea(), { key: "Enter", ctrlKey: true });
  });
}

describe("AssistantUIComposer — skills", () => {
  it("lists the enabled skills in a Skills section with source and tool count", () => {
    render(<AssistantUIComposer onSend={vi.fn()} isLoading={false} />);
    type("/");
    const listbox = screen.getByRole("listbox");
    expect(listbox.textContent).toContain(i18n.t("llmChat.skills.section"));
    expect(listbox.textContent).toContain("AWS review");
    expect(listbox.textContent).toContain(i18n.t("llmChat.skills.source.workspace"));
    expect(listbox.textContent).toContain(i18n.t("llmChat.skills.toolCount", { count: 2 }));
    expect(listbox.textContent).toContain("Tone");
    expect(listbox.textContent).toContain(i18n.t("llmChat.skills.allTools"));
    expect(listbox.textContent).not.toContain("Hidden");
  });

  it("Tab adds a skill chip and clears the trigger", () => {
    render(<AssistantUIComposer onSend={vi.fn()} isLoading={false} />);
    type("/aws");
    fireEvent.keyDown(textarea(), { key: "Tab" });
    expect(textarea().value).toBe("");
    expect(
      screen.getByRole("button", {
        name: i18n.t("llmChat.skills.removeChip", { name: "AWS review" }),
      }),
    ).toBeTruthy();
  });

  it("the chip stays across turns and is sent with every message", async () => {
    const onSend = vi.fn().mockResolvedValue(true);
    render(<AssistantUIComposer onSend={onSend} isLoading={false} />);
    type("/tone");
    fireEvent.keyDown(textarea(), { key: "Enter" });

    await sendText("first");
    await sendText("second");

    const ref = { id: "local-1", source: "local", name: "Tone" };
    expect(onSend).toHaveBeenNthCalledWith(1, "first", [], undefined, [ref]);
    expect(onSend).toHaveBeenNthCalledWith(2, "second", [], undefined, [ref]);
    expect(
      screen.getByRole("button", { name: i18n.t("llmChat.skills.removeChip", { name: "Tone" }) }),
    ).toBeTruthy();
  });

  it("removing the chip stops sending the skill", async () => {
    const onSend = vi.fn().mockResolvedValue(true);
    render(<AssistantUIComposer onSend={onSend} isLoading={false} />);
    type("/tone");
    fireEvent.keyDown(textarea(), { key: "Enter" });
    fireEvent.click(
      screen.getByRole("button", { name: i18n.t("llmChat.skills.removeChip", { name: "Tone" }) }),
    );
    await sendText("hi");
    expect(onSend).toHaveBeenCalledWith("hi", [], undefined, []);
  });

  it("a different conversation starts without the chips", async () => {
    const { rerender } = render(
      <AssistantUIComposer onSend={vi.fn()} isLoading={false} conversationId="thread-1" />,
    );
    type("/tone");
    fireEvent.keyDown(textarea(), { key: "Enter" });
    const removeLabel = i18n.t("llmChat.skills.removeChip", { name: "Tone" });
    expect(screen.getByRole("button", { name: removeLabel })).toBeTruthy();

    rerender(<AssistantUIComposer onSend={vi.fn()} isLoading={false} conversationId="thread-2" />);
    await waitFor(() => expect(screen.queryByRole("button", { name: removeLabel })).toBeNull());
  });

  it("keeps the chips when the first message creates the conversation", () => {
    const { rerender } = render(
      <AssistantUIComposer onSend={vi.fn()} isLoading={false} conversationId="" />,
    );
    type("/tone");
    fireEvent.keyDown(textarea(), { key: "Enter" });
    rerender(<AssistantUIComposer onSend={vi.fn()} isLoading={false} conversationId="thread-1" />);
    expect(
      screen.getByRole("button", { name: i18n.t("llmChat.skills.removeChip", { name: "Tone" }) }),
    ).toBeTruthy();
  });
});
