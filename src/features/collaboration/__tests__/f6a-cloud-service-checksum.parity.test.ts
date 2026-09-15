import { describe, expect, it } from "vitest";
import { snapshotChecksum } from "@/features/collaboration/utils/snapshotChecksum";
import { resolveCloudServiceId } from "@/features/diagram/model/cloud-service-id";

/**
 * F6a proof: tolerant **reads** must not change what we **write**, or the
 * collaboration checksum diverges from a client still on main / pre-F6a.
 *
 * `snapshotChecksum` canonicalises key names. Writing `serviceId: "lambda"`
 * instead of `awsService: "lambda"` produces a different hash — that is why
 * F6b needs a release window after F6a.
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

const AWS_LEGACY = {
  id: "n1",
  name: "Orders Handler",
  description: "",
  parentId: null,
  type: "aws-compute",
  awsService: "lambda",
};

const GCP_LEGACY = {
  id: "n2",
  name: "API",
  description: "",
  parentId: null,
  type: "gcp-compute",
  gcpService: "cloudrun",
};

const AZURE_LEGACY = {
  id: "n3",
  name: "Fn",
  description: "",
  parentId: null,
  type: "azure-compute",
  azureService: "functions",
};

describe("F6a checksum parity — writes stay on legacy cloud fields", () => {
  it("matches main/pre-F6a when an F6a client still writes awsService/gcpService/azureService", () => {
    const asMainWould = diagramSurface({
      n1: AWS_LEGACY,
      n2: GCP_LEGACY,
      n3: AZURE_LEGACY,
    });

    // F6a attachService / panel / create paths still emit the same keys.
    const asF6aWrites = diagramSurface({
      n1: { ...AWS_LEGACY },
      n2: { ...GCP_LEGACY },
      n3: { ...AZURE_LEGACY },
    });

    expect(snapshotChecksum(asF6aWrites)).toBe(snapshotChecksum(asMainWould));
  });

  it("diverges if cloud service were written under serviceId instead (F6b hazard)", () => {
    const legacyWrite = diagramSurface({
      n1: AWS_LEGACY,
    });
    const unifiedWrite = diagramSurface({
      n1: {
        id: "n1",
        name: "Orders Handler",
        description: "",
        parentId: null,
        type: "aws-compute",
        serviceId: "lambda",
      },
    });

    expect(snapshotChecksum(unifiedWrite)).not.toBe(snapshotChecksum(legacyWrite));
  });

  it("still resolves the cloud service when only the F6b-shaped field is present", () => {
    expect(
      resolveCloudServiceId({
        type: "aws-compute",
        serviceId: "lambda",
      } as { serviceId?: string }),
    ).toBe("lambda");
  });

  it("keeps catalog serviceId from shadowing a legacy cloud field on the same node", () => {
    expect(
      resolveCloudServiceId({
        awsService: "lambda",
        serviceId: "svc-pay",
      }),
    ).toBe("lambda");
    expect(
      snapshotChecksum(
        diagramSurface({
          n1: { ...AWS_LEGACY, serviceId: "svc-pay" },
        }),
      ),
    ).toBe(
      snapshotChecksum(
        diagramSurface({
          n1: { ...AWS_LEGACY, serviceId: "svc-pay" },
        }),
      ),
    );
  });
});
