import { describe, expect, it } from "vitest";
import { InMemoryAdapter } from "@/infrastructure/persistence";
import { McpConfigRepository, slugifyServerId, validateServerUrl } from "./mcp-connections";

describe("slugifyServerId", () => {
  it("lowercases to [a-z0-9_] and keeps ids unique", () => {
    expect(slugifyServerId("GitHub Issues", [])).toBe("github_issues");
    expect(slugifyServerId("Ação & Co.", [])).toBe("acao_co");
    expect(slugifyServerId("---", [])).toBe("server");
    expect(slugifyServerId("GitHub", ["github", "github_2"])).toBe("github_3");
  });
});

describe("validateServerUrl", () => {
  it("accepts https and plain http only on localhost", () => {
    expect(validateServerUrl("https://mcp.example.com/mcp")).toBeNull();
    expect(validateServerUrl("http://localhost:3000/mcp")).toBeNull();
    expect(validateServerUrl("http://127.0.0.1:8080/mcp")).toBeNull();
    expect(validateServerUrl("http://mcp.example.com/mcp")).toBe("insecure");
    expect(validateServerUrl("http://192.168.0.2/mcp")).toBe("insecure");
    expect(validateServerUrl("ftp://mcp.example.com")).toBe("invalid");
    expect(validateServerUrl("not a url")).toBe("invalid");
  });
});

describe("McpConfigRepository", () => {
  const server = { id: "github", rememberToken: false };

  function setup() {
    const port = new InMemoryAdapter();
    const session = new InMemoryAdapter();
    return { port, session, repository: new McpConfigRepository(port, session) };
  }

  it("persists server configs through the port", async () => {
    const { repository } = setup();
    const config = {
      id: "github",
      name: "GitHub",
      url: "https://mcp.example.com/mcp",
      enabled: true,
      rememberToken: false,
      toolModes: { delete_repo: "blocked" as const },
      hasToken: true,
    };
    await repository.saveServers([config]);
    expect(await repository.loadServers()).toEqual([config]);
  });

  it("keeps the token in the session unless remembered", async () => {
    const { port, session, repository } = setup();
    await repository.setToken(server, "t-1");
    expect(await session.getItem("llm-mcp-token:github")).toBe("t-1");
    expect(await port.getItem("llm-mcp-token:github")).toBeNull();
    expect(await repository.getToken(server)).toBe("t-1");

    await repository.setRememberToken(server, true);
    expect(await port.getItem("llm-mcp-token:github")).toBe("t-1");
    expect(await session.getItem("llm-mcp-token:github")).toBeNull();
    expect(await repository.getToken({ id: "github", rememberToken: true })).toBe("t-1");
  });

  it("turning remember off deletes the persisted token", async () => {
    const { port, session, repository } = setup();
    const remembered = { id: "github", rememberToken: true };
    await repository.setToken(remembered, "t-2");

    await repository.setRememberToken(remembered, false);

    expect(await port.getItem("llm-mcp-token:github")).toBeNull();
    // It still works for the rest of this session.
    expect(await session.getItem("llm-mcp-token:github")).toBe("t-2");
  });

  it("a session token is gone in a new session", async () => {
    const { port, repository } = setup();
    await repository.setToken(server, "t-3");
    const afterRestart = new McpConfigRepository(port, new InMemoryAdapter());
    expect(await afterRestart.getToken(server)).toBeNull();
  });

  it("deleting removes the token from both stores", async () => {
    const { port, session, repository } = setup();
    await repository.setToken({ id: "github", rememberToken: true }, "a");
    await session.setItem("llm-mcp-token:github", "b");
    await repository.deleteToken("github");
    expect(await port.getItem("llm-mcp-token:github")).toBeNull();
    expect(await session.getItem("llm-mcp-token:github")).toBeNull();
  });
});
