import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import i18n from "@/infrastructure/i18n";
import type { LLMError } from "@/features/llm/errors";
import { ErrorNotice } from "./ErrorPart";

const proxyDown: LLMError = {
  kind: "proxyUnreachable",
  status: null,
  mode: "proxy",
  provider: "openai",
  detail: "Failed to fetch",
};

const rateLimited: LLMError = {
  kind: "rate_limit",
  status: 429,
  mode: "direct",
  provider: "openai",
  detail: "",
};

describe("ErrorNotice", () => {
  it("shows the mode-aware message and retries on click", () => {
    const onRetry = vi.fn();
    render(<ErrorNotice error={proxyDown} onRetry={onRetry} onOpenSettings={() => {}} />);
    expect(screen.getByRole("alert").textContent).toContain(
      i18n.t("llmChat.error.proxyUnreachable"),
    );
    fireEvent.click(screen.getByRole("button", { name: i18n.t("llmChat.error.action.retry") }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("offers Open settings for settings-fixable errors only", () => {
    const onOpenSettings = vi.fn();
    const { rerender } = render(
      <ErrorNotice error={proxyDown} onRetry={() => {}} onOpenSettings={onOpenSettings} />,
    );
    fireEvent.click(screen.getByRole("button", { name: i18n.t("llmChat.error.action.settings") }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);

    rerender(
      <ErrorNotice error={rateLimited} onRetry={() => {}} onOpenSettings={onOpenSettings} />,
    );
    expect(
      screen.queryByRole("button", { name: i18n.t("llmChat.error.action.settings") }),
    ).toBeNull();
  });
});
