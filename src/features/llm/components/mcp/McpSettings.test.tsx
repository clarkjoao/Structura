import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/infrastructure/i18n";
import { useMcpStore } from "../../mcp/mcp-store";
import type { McpServerConfig } from "../../mcp/mcp-connections";
import { McpSettings } from "./McpSettings";

const t = (key: string, params?: Record<string, unknown>) => i18n.t(key, params);

const server: McpServerConfig = {
  id: "docs",
  name: "Docs",
  url: "https://mcp.example.com/mcp",
  enabled: true,
  rememberToken: false,
  toolModes: {},
  hasToken: true,
};

const initial = useMcpStore.getState();

beforeEach(() => {
  useMcpStore.setState({ servers: [server], runtime: {}, tokenAvailable: {}, loaded: true });
});

afterEach(() => {
  useMcpStore.setState(initial, true);
  vi.restoreAllMocks();
});

describe("McpSettings", () => {
  it("lists a server with its URL and a connected status", () => {
    useMcpStore.setState({
      runtime: {
        docs: { status: { state: "connected", latencyMs: 3 }, tools: [], definitions: [] },
      },
    });
    render(<McpSettings />);
    const row = screen.getByText("Docs").closest("li")!;
    expect(within(row).getByText("https://mcp.example.com/mcp")).toBeTruthy();
    expect(within(row).getByRole("img", { name: t("llmChat.mcp.status.connected") })).toBeTruthy();
  });

  it("explains a CORS failure with the origin to allow", () => {
    useMcpStore.setState({
      runtime: {
        docs: { status: { state: "error", error: { kind: "cors" } }, tools: [], definitions: [] },
      },
    });
    render(<McpSettings />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe(t("llmChat.mcp.error.cors", { origin: window.location.origin }));
    expect(alert.textContent).toContain(window.location.origin);
  });

  it("offers Enter token when the session token is gone", async () => {
    useMcpStore.setState({
      runtime: {
        docs: {
          status: { state: "error", error: { kind: "tokenMissing" } },
          tools: [],
          definitions: [],
        },
      },
    });
    const updateServer = vi.fn().mockResolvedValue({ ok: true, server });
    useMcpStore.setState({ updateServer });
    render(<McpSettings />);

    fireEvent.click(screen.getByRole("button", { name: t("llmChat.mcp.enterToken") }));
    const token = screen.getByLabelText(t("llmChat.mcp.form.token"));
    expect(document.activeElement).toBe(token);
    fireEvent.change(token, { target: { value: "new-token" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: t("common.save") }));
    });
    expect(updateServer).toHaveBeenCalledWith(
      "docs",
      { name: "Docs", url: "https://mcp.example.com/mcp", rememberToken: false },
      "new-token",
    );
  });

  it("shows tools with annotations and blocks one", async () => {
    const setToolMode = vi.fn().mockResolvedValue(undefined);
    useMcpStore.setState({
      setToolMode,
      runtime: {
        docs: {
          status: { state: "connected", latencyMs: 3 },
          definitions: [],
          tools: [
            {
              name: "drop_index",
              registryName: "mcp__docs__drop_index",
              description: "Drops an index.",
              annotations: { destructiveHint: true },
              supported: true,
            },
            {
              name: "odd",
              registryName: "mcp__docs__odd",
              description: "",
              annotations: {},
              supported: false,
            },
          ],
        },
      },
    });
    render(<McpSettings />);
    fireEvent.click(
      screen.getByRole("button", { name: t("llmChat.mcp.showTools", { name: "Docs" }) }),
    );

    expect(screen.getByText(t("llmChat.mcp.annotation.destructive"))).toBeTruthy();
    expect(screen.getByText(t("llmChat.mcp.unsupportedSchema"))).toBeTruthy();
    const mode = screen.getByLabelText(t("llmChat.mcp.toolMode", { name: "drop_index" }));
    // Auto and Blocked only: there is no "Ask" mode.
    expect(
      within(mode)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual([t("llmChat.mcp.mode.auto"), t("llmChat.mcp.mode.blocked")]);
    fireEvent.change(mode, { target: { value: "blocked" } });
    expect(setToolMode).toHaveBeenCalledWith("docs", "drop_index", "blocked");
  });

  it("rejects an insecure URL in the form", () => {
    render(<McpSettings />);
    fireEvent.click(screen.getByRole("button", { name: t("llmChat.mcp.add") }));
    const url = screen.getByLabelText(t("llmChat.mcp.form.url"));
    fireEvent.change(url, { target: { value: "http://example.com/mcp" } });
    fireEvent.blur(url);
    expect(screen.getByText(t("llmChat.mcp.form.urlInsecure"))).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: t("common.save") }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("tests a connection and shows the tool count and latency", async () => {
    const testConnection = vi.fn().mockResolvedValue({ ok: true, toolCount: 3, latencyMs: 42 });
    useMcpStore.setState({ testConnection });
    render(<McpSettings />);
    fireEvent.click(screen.getByRole("button", { name: t("llmChat.mcp.add") }));
    fireEvent.change(screen.getByLabelText(t("llmChat.mcp.form.url")), {
      target: { value: "https://other.example.com/mcp" },
    });
    fireEvent.change(screen.getByLabelText(t("llmChat.mcp.form.token")), {
      target: { value: "tok" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: t("llmChat.mcp.form.test") }));
    });
    expect(testConnection).toHaveBeenCalledWith("https://other.example.com/mcp", "tok");
    expect(
      await screen.findByText(t("llmChat.mcp.form.testOk", { count: 3, latency: 42 })),
    ).toBeTruthy();
  });

  it("asks before deleting a server", async () => {
    const deleteServer = vi.fn().mockResolvedValue(undefined);
    useMcpStore.setState({ deleteServer });
    render(<McpSettings />);
    fireEvent.click(screen.getByRole("button", { name: t("llmChat.mcp.delete") }));
    const dialog = await screen.findByRole("alertdialog");
    expect(deleteServer).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: t("llmChat.mcp.confirmDelete") }));
    await waitFor(() => expect(deleteServer).toHaveBeenCalledWith("docs"));
  });
});
