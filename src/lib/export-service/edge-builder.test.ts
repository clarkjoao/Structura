import { describe, expect, it } from "vitest";
import type { Connection } from "@/features/diagram";
import { buildEdgeCell, buildEdgeLabelPlain } from "./edge-builder";

function conn(partial: Partial<Connection> & Pick<Connection, "id" | "sourceId" | "targetId">): Connection {
  return {
    label: "",
    ...partial,
  };
}

describe("buildEdgeLabelPlain", () => {
  it("combines label and technology with newline", () => {
    expect(
      buildEdgeLabelPlain(
        conn({ id: "1", sourceId: "a", targetId: "b", label: "Sync", technology: "RabbitMQ" }),
      ),
    ).toBe("Sync\n(RabbitMQ)");
  });

  it("uses only parenthesized technology when label is empty", () => {
    expect(
      buildEdgeLabelPlain(conn({ id: "1", sourceId: "a", targetId: "b", technology: "gRPC" })),
    ).toBe("(gRPC)");
  });

  it("returns label only when no technology", () => {
    expect(
      buildEdgeLabelPlain(conn({ id: "1", sourceId: "a", targetId: "b", label: "Call" })),
    ).toBe("Call");
  });
});

describe("buildEdgeCell", () => {
  it("escapes XML in value attribute when technology contains angle brackets or ampersands", () => {
    const xml = buildEdgeCell(
      conn({
        id: "edge-1",
        sourceId: "a",
        targetId: "b",
        label: "A & B",
        technology: "<script> & more",
      }),
    );
    expect(xml).toContain('value="A &amp; B');
    expect(xml).toContain("&lt;script&gt;");
    expect(xml).not.toMatch(/value="[^"]*<script/);
  });

  it("produces well-formed mxCell when only technology is set", () => {
    const xml = buildEdgeCell(
      conn({ id: "e2", sourceId: "x", targetId: "y", technology: "Kafka" }),
    );
    expect(xml).toContain('value="(Kafka)"');
    expect(xml.startsWith("<mxCell")).toBe(true);
  });
});
