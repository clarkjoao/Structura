import { describe, expect, it } from "vitest";
import { edgeLabelBox } from "./edgeLabelBox";

describe("edgeLabelBox", () => {
  it("reserves nothing for a connection the canvas draws no label on", () => {
    expect(edgeLabelBox("")).toBeUndefined();
    expect(edgeLabelBox("   ", "  ")).toBeUndefined();
    expect(edgeLabelBox(undefined)).toBeUndefined();
  });

  it("grows with the text, up to the pill's truncation width", () => {
    const short = edgeLabelBox("reads")!;
    const long = edgeLabelBox("x".repeat(40))!;
    const longer = edgeLabelBox("x".repeat(400))!;

    expect(long.width).toBeGreaterThan(short.width);
    // `max-w-[160px] truncate`: past it the pill stops growing.
    expect(longer.width).toBe(long.width);
  });

  it("adds a line for the technology", () => {
    const plain = edgeLabelBox("reads")!;
    const withTech = edgeLabelBox("reads", "JDBC")!;

    expect(withTech.height).toBeGreaterThan(plain.height);
    expect(withTech.text).toBe("reads");
  });

  it("names a technology-only pill by its technology, since ELK drops an empty text", () => {
    expect(edgeLabelBox("", "gRPC")?.text).toBe("gRPC");
  });
});
