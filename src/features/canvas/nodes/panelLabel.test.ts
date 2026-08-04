import { describe, expect, it } from "vitest";
import { buildPanelHeaderLabel, buildPanelSubLabel } from "./panelLabel";

describe("buildPanelHeaderLabel", () => {
  it("drops the kind prefix when the name already says it", () => {
    expect(buildPanelHeaderLabel("vpc", "VPC", "VPC")).toBe("VPC");
    expect(buildPanelHeaderLabel("private-subnet", "Private Subnet", "Private Subnet")).toBe(
      "Private Subnet",
    );
  });

  it("drops the prefix when the name contains the kind among other words", () => {
    expect(buildPanelHeaderLabel("vpc", "VPC", "Production VPC")).toBe("Production VPC");
    expect(
      buildPanelHeaderLabel("availability-zone", "Availability Zone", "Availability Zone B"),
    ).toBe("Availability Zone B");
  });

  it("ignores case and punctuation when comparing", () => {
    expect(buildPanelHeaderLabel("private-subnet", "Private Subnet", "private-subnet-a")).toBe(
      "private-subnet-a",
    );
  });

  it("drops the prefix when the name uses the kind's acronym", () => {
    expect(buildPanelHeaderLabel("availability-zone", "Availability Zone", "AZ us-east-1a")).toBe(
      "AZ us-east-1a",
    );
    expect(buildPanelHeaderLabel("availability-zone", "Availability Zone", "az-b")).toBe("az-b");
  });

  it("does not treat an acronym buried inside a word as a match", () => {
    expect(buildPanelHeaderLabel("availability-zone", "Availability Zone", "Azure Landing")).toBe(
      "Availability Zone - Azure Landing",
    );
  });

  it("keeps the prefix when it adds information", () => {
    expect(buildPanelHeaderLabel("eks-cluster", "EKS Cluster", "prod-blue")).toBe(
      "EKS Cluster - prod-blue",
    );
    expect(buildPanelHeaderLabel("vpc", "VPC", "Shared Networking")).toBe(
      "VPC - Shared Networking",
    );
  });

  it("never prefixes a plain panel", () => {
    expect(buildPanelHeaderLabel("default", "Painel", "Payment Domain")).toBe("Payment Domain");
    expect(buildPanelHeaderLabel(undefined, "Painel", "Payment Domain")).toBe(
      "Painel - Payment Domain",
    );
  });
});

describe("buildPanelSubLabel", () => {
  it("drops the kind when the name already says it", () => {
    expect(buildPanelSubLabel("vpc", "VPC", "Production VPC", "3 elements")).toBe("3 elements");
  });

  it("keeps the kind when it adds information", () => {
    expect(buildPanelSubLabel("vpc", "VPC", "Shared Networking", "3 elements")).toBe(
      "VPC - 3 elements",
    );
  });
});
