import { describe, expect, it } from "vitest";
import { resolveCloudServiceId } from "./cloud-service-id";

describe("resolveCloudServiceId (F6a tolerance)", () => {
  it("prefers a legacy awsService over a catalog serviceId", () => {
    expect(
      resolveCloudServiceId({
        awsService: "lambda",
        serviceId: "svc-pay",
      }),
    ).toBe("lambda");
  });

  it("falls through gcp then azure then serviceId", () => {
    expect(resolveCloudServiceId({ gcpService: "cloudrun" })).toBe("cloudrun");
    expect(resolveCloudServiceId({ azureService: "functions" })).toBe("functions");
    expect(resolveCloudServiceId({ serviceId: "lambda" })).toBe("lambda");
  });

  it("returns undefined when nothing is set", () => {
    expect(resolveCloudServiceId({})).toBeUndefined();
    expect(resolveCloudServiceId({ awsService: "  " })).toBeUndefined();
  });
});
