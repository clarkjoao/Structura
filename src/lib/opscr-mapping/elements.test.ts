import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { AWS_CATEGORIES } from "@/features/cloud/providers/aws/aws.catalog";
import { AZURE_CATEGORIES } from "@/features/cloud/providers/azure/azure.catalog";
import { GCP_CATEGORIES } from "@/features/cloud/providers/gcp/gcp.catalog";
import { OSS_CATEGORIES } from "@/features/elements/families/oss/oss.catalog";
import { PROVIDER_SERVICES, elementFor, kindFor } from "./elements";

const HERE = __dirname;

const manifest = (kind: string, spec: Record<string, unknown> = {}) => ({
  kind,
  metadata: { name: "x" },
  spec,
});

describe("opscr-mapping is framework-agnostic", () => {
  it("imports nothing from the app, the plugin API or opscr", () => {
    const files = readdirSync(HERE).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
    expect(files.length).toBeGreaterThan(3);
    for (const f of files) {
      const src = readFileSync(`${HERE}/${f}`, "utf8");
      // Plugins copy this folder verbatim (sync-shared) and have no `@` alias.
      expect(src, `${f} must only use relative imports`).not.toMatch(/from\s+["']@\//);
      expect(src, `${f} must not import opscr`).not.toMatch(/from\s+["']opscr/);
      expect(src, `${f} must not reference plugin.types`).not.toMatch(/plugin\.types/);
    }
  });
});

describe("PROVIDER_SERVICES", () => {
  const catalogs = [...AWS_CATEGORIES, ...GCP_CATEGORIES, ...AZURE_CATEGORIES, ...OSS_CATEGORIES];
  const known = new Set(
    catalogs.flatMap((category) =>
      category.services.map((service) => `${category.id}/${service.id}`),
    ),
  );

  it("names only services that exist in Structura's catalogs", () => {
    for (const [kind, providers] of Object.entries(PROVIDER_SERVICES)) {
      for (const [provider, service] of Object.entries(providers)) {
        expect(
          known.has(`${service.type}/${service.catalogServiceId}`),
          `${kind} ${provider}`,
        ).toBe(true);
      }
    }
  });
});

describe("elementFor", () => {
  it("uses the catalog service of a known provider", () => {
    expect(elementFor(manifest("Database", { provider: "DynamoDB" }))).toEqual({
      type: "aws-database",
      catalogServiceId: "dynamodb",
      technology: "DynamoDB",
    });
    expect(elementFor(manifest("Topic", { provider: "Kafka" }))).toMatchObject({
      type: "oss-messaging",
      catalogServiceId: "kafka",
    });
  });

  it("falls back to a C4 container naming an unknown provider", () => {
    expect(elementFor(manifest("Database", { provider: "ClickHouse" }))).toEqual({
      type: "container",
      technology: "ClickHouse",
    });
  });

  it("does not take a provider of one Kind for another", () => {
    // SNS is a Topic provider; as an Application provider it means nothing to the table.
    expect(elementFor(manifest("Application", { provider: "SNS" }))).toEqual({
      type: "container",
      technology: "SNS",
    });
  });

  it("degrades a missing or non-string provider to a plain container", () => {
    expect(elementFor(manifest("Cache"))).toEqual({ type: "container" });
    expect(elementFor(manifest("Cache", { provider: 42 }))).toEqual({ type: "container" });
  });

  it("draws boundaries as panels, external systems as C4 systems, channels by framework", () => {
    expect(elementFor(manifest("Domain"))).toEqual({ type: "panel" });
    expect(elementFor(manifest("ApplicationService"))).toEqual({ type: "panel" });
    expect(elementFor(manifest("ExternalSystem", { provider: "Stripe" }))).toEqual({
      type: "system",
      technology: "Stripe",
    });
    expect(elementFor(manifest("Channel", { type: "Web", framework: "Next.js" }))).toEqual({
      type: "container",
      technology: "Next.js",
    });
  });
});

describe("kindFor", () => {
  it("is the inverse of elementFor for every catalog provider", () => {
    for (const [kind, providers] of Object.entries(PROVIDER_SERVICES)) {
      for (const provider of Object.keys(providers)) {
        const element = elementFor({ kind, metadata: { name: "x" }, spec: { provider } });
        const guess = kindFor(element);
        // Topic and Notification share SNS: the guess may be the other Kind, but draws the same.
        const drawn = elementFor({
          kind: guess!.kind,
          metadata: { name: "x" },
          spec: { provider: guess!.provider },
        });
        expect(drawn).toEqual(element);
      }
    }
  });

  it("names panels, systems and containers, and gives up on other shapes", () => {
    expect(kindFor({ type: "panel" })).toEqual({ kind: "Domain" });
    expect(kindFor({ type: "panel" }, "Domain")).toEqual({ kind: "ApplicationService" });
    expect(kindFor({ type: "system", technology: "Stripe" })).toEqual({
      kind: "ExternalSystem",
      provider: "Stripe",
    });
    expect(kindFor({ type: "container" })).toEqual({ kind: "Application" });
    expect(kindFor({ type: "note" })).toBeNull();
    expect(kindFor({ type: "aws-database" })).toBeNull();
  });

  it("uses the technology to pick between providers sharing a service", () => {
    expect(
      kindFor({ type: "aws-database", catalogServiceId: "aurora", technology: "AuroraMySQL" }),
    ).toEqual({
      kind: "Database",
      provider: "AuroraMySQL",
    });
    expect(kindFor({ type: "aws-database", catalogServiceId: "aurora" })).toEqual({
      kind: "Database",
      provider: "AuroraMySQL",
    });
  });
});
