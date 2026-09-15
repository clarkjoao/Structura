import { describe, expect, it } from "vitest";
import { resolveCloudServiceId } from "./cloud-service-id";

describe("resolveCloudServiceId (F6b)", () => {
  it("prefers cloudServiceId over legacy fields", () => {
    expect(
      resolveCloudServiceId({
        cloudServiceId: "lambda",
        awsService: "ec2",
      }),
    ).toBe("lambda");
  });

  it("falls through legacy aws/gcp/azure only", () => {
    expect(resolveCloudServiceId({ awsService: "lambda" })).toBe("lambda");
    expect(resolveCloudServiceId({ gcpService: "cloudrun" })).toBe("cloudrun");
    expect(resolveCloudServiceId({ azureService: "functions" })).toBe("functions");
  });

  it("does not treat business-catalog serviceId as a cloud service", () => {
    // F6a put serviceId last so it would not shadow awsService when both were
    // present; a lone catalog link still leaked (C4 system → awsService="svc-pay"
    // in the LLM serializer, and every k8s/oss node with only serviceId).
    const businessOnly = { serviceId: "svc-pay" };
    expect(resolveCloudServiceId(businessOnly)).toBeUndefined();

    const legacyPlusBusiness = { awsService: "lambda", serviceId: "svc-pay" };
    expect(resolveCloudServiceId(legacyPlusBusiness)).toBe("lambda");

    const unifiedPlusBusiness = { cloudServiceId: "lambda", serviceId: "svc-pay" };
    expect(resolveCloudServiceId(unifiedPlusBusiness)).toBe("lambda");
  });

  it("returns undefined when nothing is set", () => {
    expect(resolveCloudServiceId({})).toBeUndefined();
    expect(resolveCloudServiceId({ cloudServiceId: "  " })).toBeUndefined();
  });
});
