import { describe, expect, it } from "vitest";
import { ServiceSource } from "@/features/diagram";
import type { RepoMetadata } from "./repo.types";
import { repoToService } from "./repoToService";

const repo: RepoMetadata = {
  kind: "gitlab",
  name: "pay-api",
  description: "Payments",
  webUrl: "https://gitlab.com/acme/pay/pay-api",
  fullName: "acme/pay/pay-api",
  remoteId: 7,
  languages: ["Go", "Shell"],
  topics: ["payments"],
  updatedAt: "2026-01-01T00:00:00Z",
};

const edits = {
  name: " pay-api ",
  description: "Payments",
  owner: "",
  role: "" as const,
  technology: ["Go"],
  sync: true,
};

describe("repoToService", () => {
  it("links the source and keeps its metadata when sync is on", () => {
    const svc = repoToService(repo, edits, "api");
    expect(svc.name).toBe("pay-api");
    expect(svc.sources).toEqual([{ type: ServiceSource.Gitlab, sourceId: "acme/pay/pay-api" }]);
    expect(svc.metadata?.gitlab?.projectId).toBe(7);
    expect(svc).toMatchObject({ role: "api", roleSource: "suggested" });
    expect(svc.owner).toBeUndefined();
  });

  it("becomes a manual service that remembers the URL when sync is off", () => {
    const svc = repoToService(repo, { ...edits, sync: false }, undefined);
    expect(svc.sources).toEqual([{ type: ServiceSource.Manual }]);
    expect(svc.repositoryUrl).toBe(repo.webUrl);
    expect(svc.metadata).toBeUndefined();
    expect(svc.role).toBeUndefined();
  });

  it("marks a role picked by hand as the user's", () => {
    const svc = repoToService(repo, { ...edits, role: "worker" }, "api");
    expect(svc).toMatchObject({ role: "worker", roleSource: "user" });
  });

  it("uses the GitHub source and metadata for a GitHub repository", () => {
    const svc = repoToService({ ...repo, kind: "github", fullName: "o/r" }, edits, undefined);
    expect(svc.sources).toEqual([{ type: ServiceSource.Github, sourceId: "o/r" }]);
    expect(svc.metadata?.github?.fullName).toBe("o/r");
  });
});
