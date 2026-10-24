import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRepoMetadata, languagesBySize, NoConfigForHostError } from "./repoLookup";
import { parseRepoUrl } from "./parseRepoUrl";

afterEach(() => vi.unstubAllGlobals());

function stubFetch(routes: Record<string, unknown>) {
  const seen: { url: string; headers: Record<string, string> }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      seen.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
      const key = Object.keys(routes).find((route) => new URL(url).pathname.endsWith(route));
      if (!key) return new Response("not found", { status: 404 });
      return new Response(JSON.stringify(routes[key]), { status: 200 });
    }),
  );
  return seen;
}

describe("languagesBySize", () => {
  it("orders by share, biggest first", () => {
    expect(languagesBySize({ Shell: 5, Go: 90, SQL: 5 })[0]).toBe("Go");
  });
});

describe("fetchRepoMetadata", () => {
  it("reads a GitLab project in a subgroup through the encoded path", async () => {
    const seen = stubFetch({
      "/projects/7/languages": { Go: 80, Shell: 20 },
      "/projects/acme%2Fpay%2Fpay-api": {
        id: 7,
        name: "pay-api",
        path_with_namespace: "acme/pay/pay-api",
        description: "Payments",
        web_url: "https://gitlab.com/acme/pay/pay-api",
        topics: ["payments"],
        archived: false,
        last_activity_at: "2026-01-01T00:00:00Z",
      },
    });
    const parsed = parseRepoUrl("https://gitlab.com/acme/pay/pay-api")!;
    const meta = await fetchRepoMetadata("gitlab", parsed, { github: null, gitlab: null });
    expect(meta).toMatchObject({ kind: "gitlab", remoteId: 7, languages: ["Go", "Shell"] });
    expect(seen[0].url).toContain("https://gitlab.com/api/v4/projects/acme%2Fpay%2Fpay-api");
  });

  it("keeps the repository when only the languages call fails", async () => {
    stubFetch({
      "/repos/o/r": {
        id: 1,
        name: "r",
        full_name: "o/r",
        description: null,
        html_url: "https://github.com/o/r",
        language: "Rust",
        topics: [],
        archived: false,
        updated_at: "x",
        stargazers_count: 0,
      },
    });
    const parsed = parseRepoUrl("github.com/o/r")!;
    const meta = await fetchRepoMetadata("github", parsed, { github: null, gitlab: null });
    expect(meta.languages).toEqual(["Rust"]);
  });

  it("surfaces a 404 as an error", async () => {
    stubFetch({});
    const parsed = parseRepoUrl("github.com/o/missing")!;
    await expect(
      fetchRepoMetadata("github", parsed, { github: null, gitlab: null }),
    ).rejects.toThrow(/404/);
  });

  it("never sends a stored token to a different host", async () => {
    const seen = stubFetch({});
    const parsed = parseRepoUrl("https://github.com/o/r")!;
    await fetchRepoMetadata("github", parsed, {
      github: { baseUrl: "https://ghe.acme.corp/api/v3", token: "secret" },
      gitlab: null,
    }).catch(() => undefined);
    expect(seen.every((call) => !call.headers.Authorization)).toBe(true);
  });

  it("refuses an unknown self-hosted host with no connection", async () => {
    const parsed = parseRepoUrl("https://git.acme.corp/t/s")!;
    await expect(
      fetchRepoMetadata("gitlab", parsed, { github: null, gitlab: null }),
    ).rejects.toBeInstanceOf(NoConfigForHostError);
  });
});
