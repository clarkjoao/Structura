import { describe, expect, it } from "vitest";
import { overlayLayouts, parseLayoutFile, serializeLayoutFile } from "./layout-file";

const box = (x: number, y: number) => ({ x, y, width: 180, height: 80 });

describe("layout sidecar", () => {
  it("round-trips boxes with sorted keys, whole numbers and one element per line", () => {
    const text = serializeLayoutFile(
      new Map([
        ["Database/orders-db", box(900.4, 300.6)],
        ["Application/orders-api", box(40, 60)],
      ]),
    );
    expect(text).toBe(
      [
        "{",
        '  "version": 1,',
        '  "elements": {',
        '    "Application/orders-api": { "x": 40, "y": 60, "width": 180, "height": 80 },',
        '    "Database/orders-db": { "x": 900, "y": 301, "width": 180, "height": 80 }',
        "  }",
        "}",
        "",
      ].join("\n"),
    );
    expect(parseLayoutFile(text)!.boxes.get("Database/orders-db")).toEqual(box(900, 301));
  });

  it("serializes an empty layout as valid JSON", () => {
    expect(parseLayoutFile(serializeLayoutFile(new Map()))!.boxes.size).toBe(0);
  });

  it("skips entries that are not boxes, and treats unreadable text as absent", () => {
    const parsed = parseLayoutFile(
      JSON.stringify({ elements: { "A/a": box(1, 2), "B/b": { x: "1" }, "C/c": null } }),
    );
    expect([...parsed!.boxes.keys()]).toEqual(["A/a"]);
    expect(parseLayoutFile("{ nope")).toBeNull();
    expect(parseLayoutFile("[]")).toBeNull();
  });

  it("overlays: the second layout's boxes win", () => {
    const base = {
      boxes: new Map([
        ["A/a", box(1, 1)],
        ["B/b", box(2, 2)],
      ]),
      edgeRoutes: new Map(),
    };
    const over = { boxes: new Map([["A/a", box(9, 9)]]), edgeRoutes: new Map() };
    const merged = overlayLayouts(base, over)!;
    expect(merged.boxes.get("A/a")).toEqual(box(9, 9));
    expect(merged.boxes.get("B/b")).toEqual(box(2, 2));
    expect(overlayLayouts(null, over)).toBe(over);
    expect(overlayLayouts(base, undefined)).toBe(base);
  });
});
