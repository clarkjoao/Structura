import { afterEach, describe, expect, it, vi } from "vitest";
import { ServiceSource } from "@/features/diagram";
import type { ServiceDefinition } from "@/features/diagram";
import { findInCatalog, loadGithubOrg, loadGitlabGroup } from "./batchSources";

afterEach(() => vi.unstubAllGlobals());

function stubFetch(routes: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const key = Object.keys(routes).find((route) => new URL(url).pathname.endsWith(route));
      return key
        ? new Response(JSON.stringify(routes[key]), { status: 200 })
        : new Response("nope", { status: 404 });
    }),
  );
}

const svc = (extra: Partial<ServiceDefinition>): ServiceDefinition => ({
  id: "s1",
  name: "x",
  description: "",
  repositoryUrl: "",
  technology: [],
  ...extra,
});

describe("batch loaders", () => {
  it("lists an organisation's repositories and drops archived ones", async () => {
    stubFetch({
      "/orgs/acme/repos": [
        {
          id: 1,
          name: "a-api",
          full_name: "acme/a-api",
          description: null,
          html_url: "https://github.com/acme/a-api",
          language: "Go",
          topics: [],
          archived: false,
          updated_at: "x",
          stargazers_count: 0,
        },
        {
          id: 2,
          name: "old",
          full_name: "acme/old",
          description: null,
          html_url: "https://github.com/acme/old",
          language: null,
          topics: [],
          archived: true,
          updated_at: "x",
          stargazers_count: 0,
        },
      ],
    });
    const rows = await loadGithubOrg("acme", { baseUrl: "https://api.github.com", token: "t" });
    expect(rows.map((r) => r.key)).toEqual(["github:acme/a-api"]);
    expect(rows[0].service.technology).toEqual(["Go"]);
  });

  it("lists a GitLab group with its subgroups as GitLab services", async () => {
    stubFetch({
      "/groups/acme/projects": [
        {
          id: 9,
          name: "svc",
          path_with_namespace: "acme/pay/svc",
          description: "d",
          web_url: "https://gitlab.com/acme/pay/svc",
          topics: ["x"],
          archived: false,
          last_activity_at: "x",
        },
      ],
    });
    const rows = await loadGitlabGroup("acme", { baseUrl: "https://gitlab.com", token: "" });
    expect(rows[0].service.sources).toEqual([
      { type: ServiceSource.Gitlab, sourceId: "acme/pay/svc" },
    ]);
    expect(rows[0].service.repositoryUrl).toBe("https://gitlab.com/acme/pay/svc");
  });
});

describe("findInCatalog", () => {
  const candidate = {
    key: "github:acme/a",
    service: {
      name: "a",
      description: "",
      repositoryUrl: "https://github.com/acme/a",
      technology: [],
      sources: [{ type: ServiceSource.Github, sourceId: "acme/a" }],
    },
  };

  it("matches by source id", () => {
    const hit = svc({ sources: [{ type: ServiceSource.Github, sourceId: "acme/a" }] });
    expect(findInCatalog(candidate, [hit])).toBe(hit);
  });

  it("matches a manual service by repository URL, ignoring .git and case", () => {
    const hit = svc({ repositoryUrl: "https://GitHub.com/acme/a.git" });
    expect(findInCatalog(candidate, [hit])).toBe(hit);
  });

  it("does not match unrelated services", () => {
    expect(
      findInCatalog(candidate, [svc({ repositoryUrl: "https://github.com/acme/b" })]),
    ).toBeUndefined();
  });
});
