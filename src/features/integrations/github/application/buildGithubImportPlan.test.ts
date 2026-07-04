import { describe, expect, it } from "vitest";
import { ServiceSource, type ServiceDefinition } from "@/features/diagram";
import type { GithubRepo } from "../github.types";
import { buildGithubImportPlan } from "./buildGithubImportPlan";

function makeRepo(overrides: Partial<GithubRepo> = {}): GithubRepo {
  return {
    id: 1,
    name: "payments-api",
    full_name: "acme/payments-api",
    description: "payments service",
    html_url: "https://github.com/acme/payments-api",
    language: "TypeScript",
    topics: ["payments"],
    archived: false,
    updated_at: "2026-01-01T00:00:00Z",
    stargazers_count: 10,
    ...overrides,
  };
}

function makeService(overrides: Partial<ServiceDefinition> = {}): ServiceDefinition {
  return {
    id: "svc-1",
    name: "Payments API",
    description: "service",
    repositoryUrl: "https://github.com/acme/payments-api",
    technology: [],
    tags: [],
    sources: [{ type: ServiceSource.Manual }],
    ...overrides,
  };
}

describe("buildGithubImportPlan", () => {
  it("prioritizes DefectDojo conflict over GitHub/manual for the same repository", () => {
    const repo = makeRepo();
    const manualService = makeService({
      id: "svc-manual",
      sources: [{ type: ServiceSource.Manual }],
    });
    const githubService = makeService({
      id: "svc-github",
      sources: [{ type: ServiceSource.Github, sourceId: "acme/payments-api" }],
    });
    const defectDojoService = makeService({
      id: "svc-dd",
      sources: [{ type: ServiceSource.Defectdojo, sourceId: "42" }],
    });

    const plan = buildGithubImportPlan({
      selectedRepos: [repo],
      allServices: [manualService, githubService, defectDojoService],
    });

    expect(plan.conflictsForImport).toHaveLength(1);
    expect(plan.conflictsForImport[0]?.existingService.id).toBe("svc-dd");
  });

  it("creates auto resolutions only for GitHub-origin conflicts", () => {
    const repoGithub = makeRepo({
      id: 1,
      full_name: "acme/payments-api",
      html_url: "https://github.com/acme/payments-api",
    });
    const repoCross = makeRepo({
      id: 2,
      name: "risk-api",
      full_name: "acme/risk-api",
      html_url: "https://github.com/acme/risk-api",
    });

    const githubService = makeService({
      id: "svc-gh",
      repositoryUrl: "https://github.com/acme/payments-api",
      sources: [{ type: ServiceSource.Github, sourceId: "acme/payments-api" }],
    });
    const defectDojoService = makeService({
      id: "svc-dd",
      repositoryUrl: "https://github.com/acme/risk-api",
      sources: [{ type: ServiceSource.Defectdojo, sourceId: "99" }],
    });

    const plan = buildGithubImportPlan({
      selectedRepos: [repoGithub, repoCross],
      allServices: [githubService, defectDojoService],
    });

    expect(plan.conflictsForImport).toHaveLength(2);
    expect(plan.autoResolutions).toEqual([
      {
        existingServiceId: "svc-gh",
        fields: {
          name: "github",
          description: "github",
          technology: "merge",
          tags: "merge",
        },
      },
    ]);
    expect(plan.crossConflicts).toHaveLength(1);
    expect(plan.crossConflicts[0]?.existingService.id).toBe("svc-dd");
  });

  it("returns empty plan when there are no conflicts", () => {
    const plan = buildGithubImportPlan({
      selectedRepos: [makeRepo()],
      allServices: [
        makeService({
          id: "svc-other",
          repositoryUrl: "https://github.com/acme/other-repo",
          sources: [{ type: ServiceSource.Manual }],
        }),
      ],
    });

    expect(plan.conflictsForImport).toEqual([]);
    expect(plan.crossConflicts).toEqual([]);
    expect(plan.autoResolutions).toEqual([]);
  });
});
