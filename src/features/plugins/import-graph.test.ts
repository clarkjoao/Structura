import { describe, expect, it } from "vitest";
import { toGeneratedGraph } from "./import-graph";

const at = { x: 1, y: 2 };

describe("toGeneratedGraph", () => {
  it("maps keys, parents, catalog fields and labels to store input", () => {
    const { nodes, edges } = toGeneratedGraph({
      components: [
        { key: "p", name: "orders", type: "panel", width: 300, height: 200, ...at },
        {
          key: "db",
          name: "db",
          type: "aws-database",
          cloudServiceId: "dynamodb",
          technology: "DynamoDB",
          description: "Orders",
          parentKey: "p",
          ...at,
        },
      ],
      connections: [{ source: "db", target: "p" }],
    });
    expect(nodes).toEqual([
      {
        externalId: "p",
        type: "panel",
        name: "orders",
        parentExternalId: null,
        x: 1,
        y: 2,
        width: 300,
        height: 200,
      },
      {
        externalId: "db",
        type: "aws-database",
        name: "db",
        description: "Orders",
        parentExternalId: "p",
        cloudServiceId: "dynamodb",
        technology: "DynamoDB",
        x: 1,
        y: 2,
      },
    ]);
    expect(edges).toEqual([{ sourceExternalId: "db", targetExternalId: "p", label: "" }]);
  });

  it("degrades unsupported types and cuts parent cycles", () => {
    const { nodes } = toGeneratedGraph({
      components: [
        { key: "a", name: "a", type: "endpoint", parentKey: "b", ...at },
        { key: "b", name: "b", type: "panel", parentKey: "a", ...at },
      ],
      connections: [],
    });
    expect(nodes[0]!.type).toBe("unknown");
    expect(nodes.filter((n) => n.parentExternalId !== null)).toHaveLength(1);
  });
});
