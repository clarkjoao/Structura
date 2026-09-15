import { describe, expect, it } from "vitest";
import { PanelKind } from "@/features/diagram/enums";
import { buildGeneratedGraphInputs } from "./apply-ir";
import { mapNodeToComponent } from "./ir-to-component";
import { parseAndValidateIR } from "./ir-validator";
import type { DiagramIR } from "./ir.types";
import type { LayoutBox } from "@/features/canvas/layout/contract";

/**
 * Behaviour pin for F5c.
 *
 * Captures the structural result of a small AWS IR through validation →
 * component mapping → generated-graph inputs *before* the semanticType
 * vocabulary starts reading AWS categories from the element registry. The
 * migration must leave this snapshot unchanged — same coverage, same shapes.
 */

const SIMPLE_AWS_IR: DiagramIR = {
  type: "aws-deployment",
  nodes: [
    {
      id: "main-vpc",
      semanticType: "aws-vpc",
      name: "Main",
      awsService: "vpc",
      parentId: null,
      isBoundary: true,
      tier: "edge",
    },
    {
      id: "az-a",
      semanticType: "aws-az",
      name: "us-east-1a",
      parentId: "main-vpc",
      isBoundary: true,
      tier: "compute",
    },
    {
      id: "public-a",
      semanticType: "aws-public-subnet",
      name: "Public",
      awsService: "public-subnet",
      parentId: "az-a",
      isBoundary: true,
      tier: "edge",
    },
    {
      id: "private-a",
      semanticType: "aws-private-subnet",
      name: "Private",
      awsService: "private-subnet",
      parentId: "az-a",
      isBoundary: true,
      tier: "compute",
    },
    {
      id: "public-alb",
      semanticType: "aws-networking",
      name: "Public ALB",
      awsService: "elb",
      parentId: "public-a",
      tier: "edge",
    },
    {
      id: "orders-fn",
      semanticType: "aws-compute",
      name: "Orders Handler",
      awsService: "lambda",
      parentId: "private-a",
      tier: "compute",
    },
    {
      id: "orders-db",
      semanticType: "aws-database",
      name: "Orders DB",
      awsService: "rds",
      parentId: "private-a",
      tier: "data",
    },
  ],
  edges: [
    {
      id: "alb-to-fn",
      sourceId: "public-alb",
      targetId: "orders-fn",
      label: "invokes",
    },
    {
      id: "fn-to-db",
      sourceId: "orders-fn",
      targetId: "orders-db",
      label: "reads/writes",
    },
  ],
};

const BOXES: Record<string, LayoutBox> = {
  "main-vpc": { x: 0, y: 0, width: 900, height: 500 },
  "az-a": { x: 40, y: 40, width: 800, height: 400 },
  "public-a": { x: 40, y: 40, width: 350, height: 300 },
  "private-a": { x: 420, y: 40, width: 350, height: 300 },
  "public-alb": { x: 40, y: 40, width: 180, height: 80 },
  "orders-fn": { x: 40, y: 40, width: 180, height: 80 },
  "orders-db": { x: 40, y: 160, width: 180, height: 80 },
};

describe("F5c pin — simple AWS IR structural result", () => {
  it("validates the fixture as a complete IR document", () => {
    const result = parseAndValidateIR(JSON.stringify(SIMPLE_AWS_IR));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ir.nodes).toHaveLength(SIMPLE_AWS_IR.nodes.length);
      expect(result.ir.edges).toHaveLength(SIMPLE_AWS_IR.edges.length);
    }
  });

  it("maps each node to the same component shape the pre-registry IR produced", () => {
    const mapped = SIMPLE_AWS_IR.nodes.map((node) => ({
      id: node.id,
      ...mapNodeToComponent(node),
    }));

    expect(mapped).toEqual([
      { id: "main-vpc", type: "panel", panelKind: PanelKind.Vpc },
      { id: "az-a", type: "panel", panelKind: PanelKind.AvailabilityZone },
      { id: "public-a", type: "panel", panelKind: PanelKind.PublicSubnet },
      { id: "private-a", type: "panel", panelKind: PanelKind.PrivateSubnet },
      {
        id: "public-alb",
        type: "aws-networking",
        awsService: "elb",
      },
      {
        id: "orders-fn",
        type: "aws-compute",
        awsService: "lambda",
      },
      {
        id: "orders-db",
        type: "aws-database",
        awsService: "rds",
      },
    ]);
  });

  it("builds generated-graph inputs with the same structural fields", () => {
    const { nodes, edges } = buildGeneratedGraphInputs(
      SIMPLE_AWS_IR,
      new Map(Object.entries(BOXES)),
      { x: 0, y: 0 },
    );

    expect(
      nodes.map((node) => ({
        externalId: node.externalId,
        type: node.type,
        panelKind: node.panelKind,
        awsService: node.awsService,
        parentExternalId: node.parentExternalId,
        name: node.name,
      })),
    ).toEqual([
      {
        externalId: "main-vpc",
        type: "panel",
        panelKind: PanelKind.Vpc,
        awsService: undefined,
        parentExternalId: null,
        name: "Main",
      },
      {
        externalId: "az-a",
        type: "panel",
        panelKind: PanelKind.AvailabilityZone,
        awsService: undefined,
        parentExternalId: "main-vpc",
        name: "us-east-1a",
      },
      {
        externalId: "public-a",
        type: "panel",
        panelKind: PanelKind.PublicSubnet,
        awsService: undefined,
        parentExternalId: "az-a",
        name: "Public",
      },
      {
        externalId: "private-a",
        type: "panel",
        panelKind: PanelKind.PrivateSubnet,
        awsService: undefined,
        parentExternalId: "az-a",
        name: "Private",
      },
      {
        externalId: "public-alb",
        type: "aws-networking",
        panelKind: undefined,
        awsService: "elb",
        parentExternalId: "public-a",
        name: "Public ALB",
      },
      {
        externalId: "orders-fn",
        type: "aws-compute",
        panelKind: undefined,
        awsService: "lambda",
        parentExternalId: "private-a",
        name: "Orders Handler",
      },
      {
        externalId: "orders-db",
        type: "aws-database",
        panelKind: undefined,
        awsService: "rds",
        parentExternalId: "private-a",
        name: "Orders DB",
      },
    ]);

    expect(
      edges.map((edge) => ({
        sourceExternalId: edge.sourceExternalId,
        targetExternalId: edge.targetExternalId,
        label: edge.label,
      })),
    ).toEqual([
      {
        sourceExternalId: "public-alb",
        targetExternalId: "orders-fn",
        label: "invokes",
      },
      {
        sourceExternalId: "orders-fn",
        targetExternalId: "orders-db",
        label: "reads/writes",
      },
    ]);
  });
});
