import { describe, expect, it } from "vitest";
import type { Component, ServiceDefinition, ServiceManifestEntry } from "@/features/diagram";
import { ExternalLinkType } from "@/features/diagram";
import {
  buildFallbackEntries,
  buildServiceRelinkPlan,
  matchServiceEntry,
  planNeedsReview,
} from "./service-matching";

function service(overrides: Partial<ServiceDefinition> & { id: string }): ServiceDefinition {
  return {
    name: overrides.id,
    description: "",
    repositoryUrl: "",
    technology: [],
    ...overrides,
  };
}

function entry(overrides: Partial<ServiceManifestEntry> & { id: string }): ServiceManifestEntry {
  return {
    name: overrides.id,
    repositoryUrl: "",
    technology: [],
    ...overrides,
  };
}

function component(overrides: Partial<Component> & { id: string }): Component {
  return {
    name: overrides.id,
    description: "",
    parentId: null,
    type: "container",
    ...overrides,
  } as Component;
}

describe("matchServiceEntry", () => {
  it("matches on name plus GitHub repo id", () => {
    const local = service({
      id: "svc-local",
      name: "checkout",
      metadata: {
        github: {
          repoId: 42,
          fullName: "acme/checkout",
          topics: [],
          language: null,
          updatedAt: "",
        },
      },
    });

    const result = matchServiceEntry(
      entry({
        id: "svc-remote",
        name: "checkout",
        github: { repoId: 42, fullName: "acme/checkout" },
      }),
      [local],
    );

    expect(result.kind).toBe("match");
    if (result.kind !== "match") return;
    expect(result.service.id).toBe("svc-local");
    expect(result.signals).toContain("github-repo-id");
    expect(result.signals).toContain("name");
  });

  it("does not match on the name alone", () => {
    const local = service({ id: "svc-local", name: "api" });

    const result = matchServiceEntry(
      entry({ id: "svc-remote", name: "api", repositoryUrl: "https://github.com/acme/api" }),
      [local],
    );

    expect(result.kind).toBe("none");
  });

  it("normalizes repository URLs across git@ and https forms", () => {
    const local = service({
      id: "svc-local",
      name: "checkout",
      repositoryUrl: "git@github.com:acme/checkout.git",
    });

    const result = matchServiceEntry(
      entry({
        id: "svc-remote",
        name: "checkout",
        repositoryUrl: "https://github.com/acme/checkout",
      }),
      [local],
    );

    expect(result.kind).toBe("match");
    if (result.kind !== "match") return;
    expect(result.signals).toContain("repository-url");
  });

  it("reports ambiguity instead of guessing between equal candidates", () => {
    const a = service({
      id: "a",
      name: "checkout",
      repositoryUrl: "https://github.com/acme/checkout",
    });
    const b = service({
      id: "b",
      name: "checkout",
      repositoryUrl: "https://github.com/acme/checkout",
    });

    const result = matchServiceEntry(
      entry({ id: "remote", name: "checkout", repositoryUrl: "https://github.com/acme/checkout" }),
      [a, b],
    );

    expect(result.kind).toBe("ambiguous");
    if (result.kind !== "ambiguous") return;
    expect(result.candidates).toHaveLength(2);
  });

  it("prefers the candidate with more corroborating signals", () => {
    const weak = service({
      id: "weak",
      name: "checkout",
      repositoryUrl: "https://github.com/acme/checkout",
    });
    const strong = service({
      id: "strong",
      name: "checkout",
      repositoryUrl: "https://github.com/acme/checkout",
      metadata: {
        github: { repoId: 7, fullName: "acme/checkout", topics: [], language: null, updatedAt: "" },
      },
    });

    const result = matchServiceEntry(
      entry({
        id: "remote",
        name: "checkout",
        repositoryUrl: "https://github.com/acme/checkout",
        github: { repoId: 7, fullName: "acme/checkout" },
      }),
      [weak, strong],
    );

    expect(result.kind).toBe("match");
    if (result.kind !== "match") return;
    expect(result.service.id).toBe("strong");
  });

  it("counts a component's external link to the repository as a signal", () => {
    const local = service({
      id: "svc-local",
      name: "checkout",
      repositoryUrl: "https://github.com/acme/checkout",
    });

    const result = matchServiceEntry(
      entry({ id: "remote", name: "checkout" }),
      [local],
      ["https://github.com/acme/checkout"],
    );

    expect(result.kind).toBe("match");
    if (result.kind !== "match") return;
    expect(result.signals).toEqual(expect.arrayContaining(["name", "component-link"]));
  });

  it("ignores an empty name so blank entries never corroborate each other", () => {
    const local = service({ id: "svc-local", name: "" });

    expect(matchServiceEntry(entry({ id: "remote", name: "" }), [local]).kind).toBe("none");
  });
});

describe("buildFallbackEntries", () => {
  it("derives one entry per referenced service from the components themselves", () => {
    const components = [
      component({
        id: "c1",
        name: "checkout",
        serviceId: "svc-remote",
        externalLinks: [
          {
            id: "l1",
            label: "repo",
            url: "https://github.com/acme/checkout",
            type: ExternalLinkType.Github,
          },
        ],
      } as Partial<Component> & { id: string }),
      component({ id: "c2", name: "checkout copy", serviceId: "svc-remote" }),
      component({ id: "c3", name: "unlinked" }),
    ];

    const entries = buildFallbackEntries(components);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ id: "svc-remote", name: "checkout" });
  });

  it("splits a comma-separated technology string back into a list", () => {
    const entries = buildFallbackEntries([
      component({
        id: "c1",
        name: "api",
        serviceId: "svc",
        technology: "Node.js, Fastify",
      } as Partial<Component> & { id: string }),
    ]);

    expect(entries[0].technology).toEqual(["Node.js", "Fastify"]);
  });
});

describe("buildServiceRelinkPlan", () => {
  const localCatalog = {
    "svc-local": service({
      id: "svc-local",
      name: "checkout",
      repositoryUrl: "https://github.com/acme/checkout",
      metadata: {
        github: {
          repoId: 42,
          fullName: "acme/checkout",
          topics: [],
          language: null,
          updatedAt: "",
        },
      },
    }),
  };

  it("groups a matched entry into relink with the components that use it", () => {
    const components = [component({ id: "c1", serviceId: "svc-remote" })];

    const plan = buildServiceRelinkPlan({
      entries: [
        entry({
          id: "svc-remote",
          name: "checkout",
          repositoryUrl: "https://github.com/acme/checkout",
          github: { repoId: 42, fullName: "acme/checkout" },
        }),
      ],
      components,
      localCatalog,
    });

    expect(plan.relink).toHaveLength(1);
    expect(plan.relink[0].service.id).toBe("svc-local");
    expect(plan.relink[0].componentIds).toEqual(["c1"]);
    expect(planNeedsReview(plan)).toBe(true);
  });

  it("skips an entry whose id already exists in the receiving catalog", () => {
    const plan = buildServiceRelinkPlan({
      entries: [entry({ id: "svc-local", name: "checkout" })],
      components: [component({ id: "c1", serviceId: "svc-local" })],
      localCatalog,
    });

    expect(plan.alreadyLocal).toHaveLength(1);
    expect(plan.relink).toHaveLength(0);
    expect(planNeedsReview(plan)).toBe(false);
  });

  it("lists an unmatched entry, carrying the ambiguous candidates when there were any", () => {
    const plan = buildServiceRelinkPlan({
      entries: [entry({ id: "svc-remote", name: "billing" })],
      components: [component({ id: "c1", serviceId: "svc-remote" })],
      localCatalog,
    });

    expect(plan.unmatched).toHaveLength(1);
    expect(plan.unmatched[0].ambiguousCandidates).toEqual([]);
  });

  it("uses the component's external links as evidence when the manifest has no URL", () => {
    const components = [
      component({
        id: "c1",
        name: "checkout",
        serviceId: "svc-remote",
        externalLinks: [
          {
            id: "l1",
            label: "repo",
            url: "https://github.com/acme/checkout",
            type: ExternalLinkType.Github,
          },
        ],
      } as Partial<Component> & { id: string }),
    ];

    const plan = buildServiceRelinkPlan({
      entries: buildFallbackEntries(components),
      components,
      localCatalog,
    });

    expect(plan.relink).toHaveLength(1);
    expect(plan.relink[0].signals).toEqual(expect.arrayContaining(["name", "component-link"]));
  });
});
