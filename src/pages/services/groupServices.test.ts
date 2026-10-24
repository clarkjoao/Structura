import { describe, expect, it } from "vitest";
import type { ServiceDefinition } from "@/features/diagram";
import { countByRole, groupServices } from "./groupServices";

const svc = (
  id: string,
  name: string,
  extra: Partial<ServiceDefinition> = {},
): ServiceDefinition => ({
  id,
  name,
  description: "",
  repositoryUrl: "",
  technology: [],
  ...extra,
});

const list = [
  svc("1", "pay-api", { technology: ["Go"] }),
  svc("2", "mail-worker", { technology: ["Go", "SQS"] }),
  svc("3", "Plain", { role: "api" }),
  svc("4", "Mystery"),
];

describe("groupServices", () => {
  it("groups by role in a fixed order with unassigned last", () => {
    expect(groupServices(list, "role").map((g) => [g.key, g.services.length])).toEqual([
      ["api", 2],
      ["worker", 1],
      ["none", 1],
    ]);
  });

  it("groups by first technology", () => {
    expect(groupServices(list, "technology").map((g) => g.key)).toEqual(["Go", "none"]);
  });

  it("groups by source, defaulting to manual", () => {
    expect(groupServices(list, "source").map((g) => g.key)).toEqual(["manual"]);
  });
});

describe("countByRole", () => {
  it("counts declared and suggested roles", () => {
    expect(countByRole(list)).toMatchObject({ all: 4, api: 2, worker: 1, none: 1 });
  });
});
