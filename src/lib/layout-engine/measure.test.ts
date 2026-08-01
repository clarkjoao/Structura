import { describe, it, expect } from "vitest";
import {
  measureLabelNode,
  measureIntrinsicNode,
  measureNode,
  measureNodes,
  hasIntrinsicSize,
  type MeasurableNode,
  type MeasureText,
} from "./measure";
import { approximateMeasureText } from "./measure-text";
import { CUSTOM_NODE_TYPOGRAPHY } from "./typography";

/** Fixed-width measurer: makes expected sizes exactly computable in assertions. */
const fixedMeasure: MeasureText = (text, style) => text.length * style.fontSize * 0.5;

const box = CUSTOM_NODE_TYPOGRAPHY.box;

describe("measureLabelNode", () => {
  it("never renders below the shell min-width or above its max-width", () => {
    const tiny: MeasurableNode = { id: "a", type: "system", name: "A" };
    const huge: MeasurableNode = {
      id: "b",
      type: "system",
      name: "A service with an extremely long name that would overflow any sane node shell",
    };

    expect(measureLabelNode(tiny, fixedMeasure).width).toBe(box.minWidth);
    expect(measureLabelNode(huge, fixedMeasure).width).toBe(box.maxWidth);
  });

  it("grows taller as segments are added", () => {
    const nameOnly: MeasurableNode = { id: "a", type: "system", name: "Payment Service" };
    const withDescription: MeasurableNode = { ...nameOnly, description: "Handles payments" };
    const withAll: MeasurableNode = { ...withDescription, technology: "Node.js" };

    const h1 = measureLabelNode(nameOnly, fixedMeasure).height;
    const h2 = measureLabelNode(withDescription, fixedMeasure).height;
    const h3 = measureLabelNode(withAll, fixedMeasure).height;

    expect(h2).toBeGreaterThan(h1);
    expect(h3).toBeGreaterThan(h2);
  });

  it("caps description growth at the CSS line-clamp, so height stays bounded", () => {
    // `line-clamp-2` clips beyond two lines; measuring more would reserve dead space.
    const short: MeasurableNode = {
      id: "a",
      type: "system",
      name: "Service",
      description: "Two words",
    };
    const veryLong: MeasurableNode = {
      id: "b",
      type: "system",
      name: "Service",
      description: "word ".repeat(200),
    };

    const shortHeight = measureLabelNode(short, fixedMeasure).height;
    const longHeight = measureLabelNode(veryLong, fixedMeasure).height;

    const oneLine =
      CUSTOM_NODE_TYPOGRAPHY.description.fontSize * CUSTOM_NODE_TYPOGRAPHY.description.lineHeight;

    expect(longHeight - shortHeight).toBeLessThanOrEqual(Math.ceil(oneLine) + 1);
  });

  it("never returns a height below the configured floor", () => {
    const node: MeasurableNode = { id: "a", type: "person", name: "X" };
    expect(measureLabelNode(node, fixedMeasure).height).toBeGreaterThanOrEqual(box.minHeight);
  });

  it("is deterministic for identical input", () => {
    const node: MeasurableNode = {
      id: "a",
      type: "container",
      name: "Order Service",
      technology: "Go",
      description: "Owns the order lifecycle",
    };
    expect(measureLabelNode(node, approximateMeasureText)).toEqual(
      measureLabelNode(node, approximateMeasureText),
    );
  });
});

describe("intrinsic-size node types", () => {
  it("classifies container and content-driven types as intrinsic", () => {
    for (const type of ["panel", "db-table", "json-viewer", "api-group", "note", "svg"] as const) {
      expect(hasIntrinsicSize(type)).toBe(true);
    }
    for (const type of ["person", "system", "container", "component", "aws-compute"] as const) {
      expect(hasIntrinsicSize(type)).toBe(false);
    }
  });

  it("treats defaultSize as a floor that real content can exceed", () => {
    const defaultSize = { width: 300, height: 180 };

    expect(measureIntrinsicNode({ defaultSize })).toEqual(defaultSize);

    expect(measureIntrinsicNode({ defaultSize, contentSize: { width: 520, height: 640 } })).toEqual(
      {
        width: 520,
        height: 640,
      },
    );

    // Content smaller than the floor must not shrink the node below it.
    expect(measureIntrinsicNode({ defaultSize, contentSize: { width: 100, height: 40 } })).toEqual(
      defaultSize,
    );
  });

  it("ignores label text entirely for intrinsic types", () => {
    const defaultSizeFor = () => ({ width: 300, height: 180 });

    const shortLabel = measureNode(
      { id: "t1", type: "db-table", name: "users" },
      { measureText: fixedMeasure, defaultSizeFor },
    );
    const longLabel = measureNode(
      { id: "t2", type: "db-table", name: "a".repeat(300), description: "b".repeat(300) },
      { measureText: fixedMeasure, defaultSizeFor },
    );

    expect(shortLabel).toEqual(longLabel);
  });
});

describe("measureNodes", () => {
  it("measures every node and keys the result by id", () => {
    const nodes: MeasurableNode[] = [
      { id: "a", type: "person", name: "Customer" },
      { id: "b", type: "system", name: "Billing", technology: "Java" },
      { id: "c", type: "panel", name: "VPC" },
    ];

    const sizes = measureNodes(nodes, {
      measureText: approximateMeasureText,
      defaultSizeFor: () => ({ width: 600, height: 400 }),
    });

    expect([...sizes.keys()].sort()).toEqual(["a", "b", "c"]);
    for (const size of sizes.values()) {
      expect(size.width).toBeGreaterThan(0);
      expect(size.height).toBeGreaterThan(0);
    }
    // The panel took the intrinsic path.
    expect(sizes.get("c")).toEqual({ width: 600, height: 400 });
  });

  it("runs without any DOM — the engine must stay headless-testable", () => {
    const sizes = measureNodes([{ id: "a", type: "system", name: "Headless" }], {
      measureText: approximateMeasureText,
    });
    expect(sizes.get("a")?.width).toBeGreaterThanOrEqual(box.minWidth);
  });
});

describe("approximateMeasureText", () => {
  it("scales with string length and font size", () => {
    const style = CUSTOM_NODE_TYPOGRAPHY.name;
    expect(approximateMeasureText("nn", style)).toBeGreaterThan(approximateMeasureText("n", style));
    expect(approximateMeasureText("abc", { ...style, fontSize: 20 })).toBeGreaterThan(
      approximateMeasureText("abc", { ...style, fontSize: 10 }),
    );
  });

  it("gives narrow glyphs less advance than wide ones", () => {
    const style = CUSTOM_NODE_TYPOGRAPHY.name;
    expect(approximateMeasureText("lllll", style)).toBeLessThan(
      approximateMeasureText("MMMMM", style),
    );
  });

  it("returns zero for empty text", () => {
    expect(approximateMeasureText("", CUSTOM_NODE_TYPOGRAPHY.name)).toBe(0);
  });
});
