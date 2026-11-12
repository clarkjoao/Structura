import { act, render } from "@testing-library/react";
import { memo } from "react";
import { describe, expect, it } from "vitest";
import { EdgeLabelRevealProvider } from "./EdgeLabelRevealContext";
import { HandleHighlightProvider } from "./HandleHighlightContext";
import { useIsEdgeLabelRevealed } from "./edgeLabelReveal";
import {
  useIsConnectionHandleHighlighted,
  useIsNodeHandleHighlighted,
} from "./highlightMembership";
import { createIdSetStore } from "./idSetStore";

/**
 * Canvas-wide id sets reach nodes and edges as membership, not as a context
 * value: a highlight or a selection re-renders the elements that joined or
 * left the set, and no other.
 */

describe("createIdSetStore", () => {
  it("answers membership and tells listeners when the set is replaced", () => {
    const store = createIdSetStore(new Set(["a"]));
    let calls = 0;
    store.subscribe(() => (calls += 1));
    expect(store.has("a")).toBe(true);
    const next = new Set(["b"]);
    store.set(next);
    store.set(next);
    expect(store.has("a")).toBe(false);
    expect(store.has("b")).toBe(true);
    expect(calls).toBe(1);
  });
});

const renders = new Map<string, number>();
const count = (key: string) => renders.set(key, (renders.get(key) ?? 0) + 1);

const NodeProbe = memo(function NodeProbe({ id }: { id: string }) {
  count(`node:${id}`);
  return <span data-node={id} data-on={String(useIsNodeHandleHighlighted(id))} />;
});

const EdgeProbe = memo(function EdgeProbe({ id }: { id: string }) {
  count(`edge:${id}`);
  const highlighted = useIsConnectionHandleHighlighted(id);
  const revealed = useIsEdgeLabelRevealed(id);
  return <span data-edge={id} data-on={`${highlighted}/${revealed}`} />;
});

const noop = () => {};

function Surface({
  nodeIds,
  connectionIds,
  revealed,
}: {
  nodeIds: Set<string>;
  connectionIds: Set<string>;
  revealed: ReadonlySet<string>;
}) {
  return (
    <HandleHighlightProvider
      value={{
        highlightedNodeIds: nodeIds,
        highlightedConnectionIds: connectionIds,
        setHighlight: noop,
        clearHighlight: noop,
      }}
    >
      <EdgeLabelRevealProvider value={revealed}>
        <NodeProbe id="a" />
        <NodeProbe id="b" />
        <EdgeProbe id="e1" />
        <EdgeProbe id="e2" />
      </EdgeLabelRevealProvider>
    </HandleHighlightProvider>
  );
}

describe("membership hooks", () => {
  it("re-render only the elements whose membership changed", () => {
    const view = render(
      <Surface nodeIds={new Set()} connectionIds={new Set()} revealed={new Set(["e2"])} />,
    );
    const state = (selector: string) =>
      view.container.querySelector(selector)?.getAttribute("data-on");
    expect(state('[data-edge="e2"]')).toBe("false/true");

    renders.clear();
    act(() => {
      view.rerender(
        <Surface
          nodeIds={new Set(["a"])}
          connectionIds={new Set(["e1"])}
          revealed={new Set(["e2"])}
        />,
      );
    });

    expect(state('[data-node="a"]')).toBe("true");
    expect(state('[data-node="b"]')).toBe("false");
    expect(state('[data-edge="e1"]')).toBe("true/false");
    expect(state('[data-edge="e2"]')).toBe("false/true");
    expect([...renders.keys()].sort()).toEqual(["edge:e1", "node:a"]);
  });

  it("answer false without a provider", () => {
    const view = render(
      <>
        <NodeProbe id="a" />
        <EdgeProbe id="e1" />
      </>,
    );
    expect(view.container.querySelector('[data-node="a"]')?.getAttribute("data-on")).toBe("false");
    expect(view.container.querySelector('[data-edge="e1"]')?.getAttribute("data-on")).toBe(
      "false/false",
    );
  });
});
