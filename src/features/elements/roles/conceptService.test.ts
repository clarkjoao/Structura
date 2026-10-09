import { describe, expect, it } from "vitest";
import { familiesResolving, serviceForConcept } from "./conceptService";
import { CATALOG_CONCEPTS } from "../search/concepts";
import { getElement } from "../element.registry";

/** The role → service table the pattern catalog audit approved (docs/investigation/pattern-catalog-audit.md §4). */
const TABLE = {
  aws: {
    queue: "sqs",
    topic: "sns",
    "event-bus": "eventbridge",
    stream: "kinesis",
    cache: "elasticache",
    "relational-db": "rds",
    "nosql-db": "dynamodb",
    warehouse: "redshift",
    "object-storage": "s3",
    cdn: "cloudfront",
    "api-gateway": "api-gateway",
    "load-balancer": "elb",
    dns: "route53",
    serverless: "lambda",
    workflow: "step-functions",
    identity: "cognito",
    secrets: "secrets-manager",
    monitoring: "cloudwatch",
  },
  azure: {
    queue: "servicebus",
    topic: "servicebus",
    "event-bus": "eventgrid",
    stream: "eventhubs",
    cache: "rediscache",
    "relational-db": "sqldatabase",
    "nosql-db": "cosmosdb",
    warehouse: "datawarehouse",
    "object-storage": "storageblob",
    cdn: "cdn",
    "api-gateway": "apimanagement",
    "load-balancer": "loadbalancer",
    dns: "dns",
    serverless: "functions",
    workflow: "logicapps",
    identity: "activedirectory",
    secrets: "keyvault",
    monitoring: "appinsights",
  },
  gcp: {
    queue: null,
    topic: null,
    "event-bus": null,
    stream: null,
    cache: null,
    "relational-db": "cloudsql",
    "nosql-db": null,
    warehouse: "bigquery",
    "object-storage": "cloud-storage",
    cdn: null,
    "api-gateway": "apigee",
    "load-balancer": null,
    dns: null,
    serverless: "cloudrun",
    workflow: null,
    identity: null,
    secrets: null,
    monitoring: "observability",
  },
} as const;

describe("serviceForConcept", () => {
  for (const [family, roles] of Object.entries(TABLE)) {
    for (const [role, expected] of Object.entries(roles)) {
      it(`${family} ${role} → ${expected ?? "gap"}`, () => {
        const resolved = serviceForConcept(family, role as (typeof CATALOG_CONCEPTS)[number]);
        expect(resolved?.serviceId ?? null).toBe(expected);
        if (resolved) expect(getElement(resolved.type)?.family).toBe(family);
      });
    }
  }

  it("is null for an unknown family", () => {
    expect(serviceForConcept("nope", "queue")).toBeNull();
  });

  it("lists the families that can stand in for a role", () => {
    const ids = familiesResolving(["queue"]).map((family) => family.id);
    expect(ids).toEqual(expect.arrayContaining(["aws", "azure", "oss"]));
    expect(ids).not.toContain("gcp");
  });
});
