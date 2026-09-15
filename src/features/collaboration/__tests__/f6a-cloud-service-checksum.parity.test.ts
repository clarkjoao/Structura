import { describe, expect, it } from "vitest";
import { snapshotChecksum } from "@/features/collaboration/utils/snapshotChecksum";
import { resolveCloudServiceId } from "@/features/diagram/model/cloud-service-id";

/**
 * F6b cutover notes for collaboration.
 *
 * F6a proved that writing legacy fields keeps checksum parity with main.
 * F6b writes `cloudServiceId` instead — checksums **diverge** from a peer that
 * still writes `awsService`. That is expected and is why this branch must not
 * deploy until F6a has had a release window in production (tolerant readers
 * everywhere; no mixed write shapes in one room).
 */

function diagramSurface(components: Record<string, unknown>) {
  return {
    activeSceneId: null,
    compareSceneId: null,
    components,
    connections: {},
    description: "",
    diagramName: "parity",
    domain: "",
    edgeLayouts: {},
    flows: {},
    iconLibrary: {},
    nodeLayouts: {},
    scenes: {},
  };
}

describe("F6b checksum — unified write diverges from legacy (by design)", () => {
  it("diverges when cloud service is written as cloudServiceId vs awsService", () => {
    const legacyWrite = diagramSurface({
      n1: {
        id: "n1",
        name: "Orders Handler",
        description: "",
        parentId: null,
        type: "aws-compute",
        awsService: "lambda",
      },
    });
    const f6bWrite = diagramSurface({
      n1: {
        id: "n1",
        name: "Orders Handler",
        description: "",
        parentId: null,
        type: "aws-compute",
        cloudServiceId: "lambda",
      },
    });

    expect(snapshotChecksum(f6bWrite)).not.toBe(snapshotChecksum(legacyWrite));
  });

  it("still resolves both shapes for icon/export via resolveCloudServiceId", () => {
    expect(resolveCloudServiceId({ awsService: "lambda" })).toBe("lambda");
    expect(resolveCloudServiceId({ cloudServiceId: "lambda" })).toBe("lambda");
    expect(resolveCloudServiceId({ cloudServiceId: "lambda", serviceId: "svc-pay" })).toBe(
      "lambda",
    );
    expect(resolveCloudServiceId({ serviceId: "svc-pay" })).toBeUndefined();
  });
});
