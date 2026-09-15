import { describe, expect, it } from "vitest";
import { iconResolverForFamily } from "../family-icon-resolvers";
import { awsElements, awsFamily } from "./aws.family";

describe("aws family", () => {
  it("produces one descriptor per catalog category", () => {
    expect(awsElements).toHaveLength(awsFamily.categories.length);
    expect(awsElements.every((element) => element.family === "aws")).toBe(true);
  });

  it("remembers the AWS icon resolver for palette.icon lookups", () => {
    expect(iconResolverForFamily("aws")).toBe(awsFamily.icons);
  });

  it("exports lambda through kind aws with a real mxgraph icon id", () => {
    const compute = awsElements.find((element) => element.id === "aws-compute")!;
    const node = compute.export.drawio.toExportNode(
      {
        id: "n1",
        name: "Lambda",
        description: "",
        parentId: null,
        type: "aws-compute",
        cloudServiceId: "lambda",
      },
      { id: "n1", parentId: null, x: 0, y: 0, width: 180, height: 80 },
    );

    expect(node).toMatchObject({
      kind: "aws",
      name: "Lambda",
      awsIcon: "lambda",
    });
  });

  it("falls back to general when AWS_RESICON has no entry (parity with main)", () => {
    const compute = awsElements.find((element) => element.id === "aws-ml")!;
    const node = compute.export.drawio.toExportNode(
      {
        id: "n1",
        name: "Amazon Q",
        description: "",
        parentId: null,
        type: "aws-ml",
        cloudServiceId: "q",
      },
      { id: "n1", parentId: null, x: 0, y: 0, width: 180, height: 80 },
    );

    expect(node).toMatchObject({ kind: "aws", awsIcon: "general" });
  });

  it("writes cloudServiceId from ElementCreateOptions.serviceId", () => {
    const compute = awsElements.find((element) => element.id === "aws-compute")!;
    const created = compute.model.createComponent(
      { id: "el-1", name: "Fn", description: "", parentId: null },
      { serviceId: "lambda" },
    );

    expect(created).toMatchObject({
      type: "aws-compute",
      cloudServiceId: "lambda",
    });
  });
});
