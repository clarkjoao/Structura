import { describe, expect, it } from "vitest";
import { effectiveServiceRole, suggestServiceRole } from "./service-role";

const svc = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  repositoryUrl: "",
  ...extra,
});

describe("suggestServiceRole", () => {
  it.each([
    ["payments-api", "api"],
    ["edge-gateway", "api"],
    ["web-bff", "api"],
    ["invoice-worker", "worker"],
    ["order-consumer", "worker"],
    ["nightly-cron", "worker"],
    ["stripe-client", "integration"],
    ["erp-connector", "integration"],
    ["pricing-engine", "domain-engine"],
    ["billing-core", "domain-engine"],
  ])("%s -> %s", (name, role) => {
    expect(suggestServiceRole(svc(name))).toBe(role);
  });

  it("prefers the last segment over earlier ones", () => {
    expect(suggestServiceRole(svc("payment-api-client"))).toBe("integration");
  });

  it("falls back to the repository name, then topics", () => {
    expect(
      suggestServiceRole(svc("Payments", { repositoryUrl: "https://github.com/o/pay-worker.git" })),
    ).toBe("worker");
    expect(
      suggestServiceRole(
        svc("Payments", {
          metadata: { github: { topics: ["gateway"] } },
        }),
      ),
    ).toBe("api");
  });

  it("uses stack hints only as a last resort", () => {
    expect(
      suggestServiceRole(svc("Payments", { metadata: { github: { topics: ["lambda"] } } })),
    ).toBe("worker");
  });

  it("returns undefined when nothing matches", () => {
    expect(suggestServiceRole(svc("Payments"))).toBeUndefined();
  });
});

describe("effectiveServiceRole", () => {
  it("keeps a declared role over the suggestion", () => {
    const service = {
      id: "1",
      description: "",
      technology: [],
      ...svc("x-api"),
      role: "worker" as const,
    };
    expect(effectiveServiceRole(service)).toBe("worker");
  });
});
