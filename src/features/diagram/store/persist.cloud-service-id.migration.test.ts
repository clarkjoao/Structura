import { describe, expect, it } from "vitest";
import type { Component } from "@/features/diagram/model/diagram.types";
import {
  migrateUnifyCloudServiceId,
  mergePersistedState,
  PERSIST_SCHEMA_VERSION,
} from "./persist.config";
import type { DiagramStore } from "./store.types";
import { resolveCloudServiceId } from "@/features/diagram/model/cloud-service-id";

function makeStateWithComponents(components: Record<string, Component>): Partial<DiagramStore> {
  return {
    diagrams: {
      d1: {
        snapshot: { components },
        versions: {
          s1: {
            addedComponents: {
              "scene-aws": {
                type: "aws-compute",
                awsService: "lambda",
              } as unknown as Component,
            },
          },
        },
      } as never,
    },
  } as Partial<DiagramStore>;
}

function getComponent(state: Partial<DiagramStore>, id: string): Record<string, unknown> {
  return (
    state.diagrams as unknown as Record<
      string,
      { snapshot: { components: Record<string, Record<string, unknown>> } }
    >
  ).d1.snapshot.components[id];
}

function getSceneComponent(state: Partial<DiagramStore>, id: string): Record<string, unknown> {
  return (
    state.diagrams as unknown as Record<
      string,
      {
        versions: Record<string, { addedComponents: Record<string, Record<string, unknown>> }>;
      }
    >
  ).d1.versions.s1.addedComponents[id];
}

describe("v12 -> v13: aws/gcp/azureService -> cloudServiceId", () => {
  it("keeps PERSIST_SCHEMA_VERSION at or above 13 (cloudServiceId cutover)", () => {
    expect(PERSIST_SCHEMA_VERSION).toBeGreaterThanOrEqual(13);
  });

  it("unifies legacy cloud fields on snapshot components and scene additions", () => {
    const state = makeStateWithComponents({
      aws: { type: "aws-compute", awsService: "lambda" } as unknown as Component,
      gcp: { type: "gcp-compute", gcpService: "cloudrun" } as unknown as Component,
      azure: { type: "azure-compute", azureService: "functions" } as unknown as Component,
    });

    migrateUnifyCloudServiceId(state);

    expect(getComponent(state, "aws")).toMatchObject({ cloudServiceId: "lambda" });
    expect(getComponent(state, "gcp")).toMatchObject({ cloudServiceId: "cloudrun" });
    expect(getComponent(state, "azure")).toMatchObject({ cloudServiceId: "functions" });
    expect(getComponent(state, "aws").awsService).toBeUndefined();
    expect(getComponent(state, "gcp").gcpService).toBeUndefined();
    expect(getComponent(state, "azure").azureService).toBeUndefined();

    expect(getSceneComponent(state, "scene-aws")).toMatchObject({ cloudServiceId: "lambda" });
    expect(getSceneComponent(state, "scene-aws").awsService).toBeUndefined();
  });

  it("round-trips a legacy fixture through mergePersistedState without losing the icon id", () => {
    const state = makeStateWithComponents({
      n1: {
        type: "aws-compute",
        awsService: "lambda",
        serviceId: "svc-pay",
      } as unknown as Component,
    });

    const merged = mergePersistedState(state, {} as DiagramStore);
    const n1 = getComponent(merged, "n1");

    expect(n1.cloudServiceId).toBe("lambda");
    expect(n1.serviceId).toBe("svc-pay");
    expect(n1.awsService).toBeUndefined();
    expect(resolveCloudServiceId(n1 as { cloudServiceId?: string; serviceId?: string })).toBe(
      "lambda",
    );
  });

  it("keeps an existing cloudServiceId when a legacy field is also present", () => {
    const state = makeStateWithComponents({
      n1: {
        type: "aws-compute",
        cloudServiceId: "lambda",
        awsService: "ec2",
      } as unknown as Component,
    });

    migrateUnifyCloudServiceId(state);
    migrateUnifyCloudServiceId(state);

    expect(getComponent(state, "n1")).toMatchObject({ cloudServiceId: "lambda" });
    expect(getComponent(state, "n1").awsService).toBeUndefined();
  });
});
