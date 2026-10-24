import { describe, expect, it } from "vitest";
import { hostOf, parseRepoUrl } from "./parseRepoUrl";

describe("parseRepoUrl", () => {
  it.each([
    ["https://github.com/org/repo", "github", "org/repo"],
    ["https://github.com/org/repo.git", "github", "org/repo"],
    ["https://github.com/org/repo/", "github", "org/repo"],
    ["https://github.com/org/repo/tree/main/src", "github", "org/repo"],
    ["https://www.github.com/org/repo?tab=readme#top", "github", "org/repo"],
    ["github.com/org/repo", "github", "org/repo"],
    ["git@github.com:org/repo.git", "github", "org/repo"],
    ["ssh://git@github.com/org/repo.git", "github", "org/repo"],
    ["https://gitlab.com/group/repo", "gitlab", "group/repo"],
    ["https://gitlab.com/group/sub/repo", "gitlab", "group/sub/repo"],
    ["https://gitlab.com/group/sub/deep/repo.git/", "gitlab", "group/sub/deep/repo"],
    ["https://gitlab.com/group/sub/repo/-/tree/main", "gitlab", "group/sub/repo"],
    ["git@gitlab.com:group/sub/repo.git", "gitlab", "group/sub/repo"],
    ["ssh://git@gitlab.com:2222/group/repo.git", "gitlab", "group/repo"],
  ])("%s -> %s %s", (input, kind, path) => {
    expect(parseRepoUrl(input)).toMatchObject({ kind, path });
  });

  it("builds a canonical web URL", () => {
    expect(parseRepoUrl("git@gitlab.com:g/s/r.git")?.webUrl).toBe("https://gitlab.com/g/s/r");
  });

  it("leaves an unknown self-hosted host without a kind", () => {
    expect(parseRepoUrl("https://git.acme.corp/team/svc.git")).toMatchObject({
      kind: undefined,
      host: "git.acme.corp",
      path: "team/svc",
    });
  });

  it("recognises a self-hosted host that is configured", () => {
    const known = { gitlab: ["git.acme.corp"], github: ["ghe.acme.corp"] };
    expect(parseRepoUrl("https://git.acme.corp/team/sub/svc", known)?.kind).toBe("gitlab");
    expect(parseRepoUrl("git@ghe.acme.corp:team/svc.git", known)?.kind).toBe("github");
  });

  it.each(["", "   ", "github.com", "https://github.com/org", "not a url", "git@github.com:org"])(
    "rejects %j",
    (input) => {
      expect(parseRepoUrl(input)).toBeUndefined();
    },
  );
});

describe("hostOf", () => {
  it("strips the api. prefix and scheme", () => {
    expect(hostOf("https://api.github.com")).toBe("github.com");
    expect(hostOf("https://ghe.acme.corp/api/v3")).toBe("ghe.acme.corp");
    expect(hostOf("gitlab.acme.corp")).toBe("gitlab.acme.corp");
    expect(hostOf(undefined)).toBeUndefined();
  });
});
