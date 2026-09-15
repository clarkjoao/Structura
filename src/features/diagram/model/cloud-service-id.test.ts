import { describe, expect, it } from "vitest";
import { resolveCloudServiceId } from "./cloud-service-id";

describe("resolveCloudServiceId (F6b)", () => {
  it("prefers cloudServiceId over legacy fields and catalog serviceId", () => {
    expect(
      resolveCloudServiceId({
        cloudServiceId: "lambda",
        awsService: "ec2",
        serviceId: "svc-pay",
      }),
    ).toBe("lambda");
  });

  it("falls through legacy aws/gcp/azure then catalog serviceId", () => {
    expect(resolveCloudServiceId({ awsService: "lambda" })).toBe("lambda");
    expect(resolveCloudServiceId({ gcpService: "cloudrun" })).toBe("cloudrun");
    expect(resolveCloudServiceId({ azureService: "functions" })).toBe("functions");
    expect(resolveCloudServiceId({ serviceId: "lambda" })).toBe("lambda");
  });

  it("keeps catalog serviceId from shadowing a legacy cloud field", () => {
    expect(
      resolveCloudServiceId({
        awsService: "lambda",
        serviceId: "svc-pay",
      }),
    ).toBe("lambda");
  });

  it("returns undefined when nothing is set", () => {
    expect(resolveCloudServiceId({})).toBeUndefined();
    expect(resolveCloudServiceId({ cloudServiceId: "  " })).toBeUndefined();
  });
});
