import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { ReactFlowProvider, type Node, type NodeProps } from "@xyflow/react";
import SvgNode, { type SvgNodeData } from "./SvgNode";
import { CustomIconRenderer } from "@/features/canvas/components/icons/CustomIconRenderer";

const PAYLOAD =
  '<svg xmlns="http://www.w3.org/2000/svg" onload="window.__pwned = 1"><script>window.__pwned = 2</script>' +
  '<a href="javascript:window.__pwned = 3"><circle id="ok" cx="5" cy="5" r="4"/></a></svg>';

function renderSvgNode(svgContent: string, showBorder: boolean) {
  const props: NodeProps<Node<SvgNodeData>> = {
    id: "s",
    type: "svg",
    selected: false,
    dragging: false,
    zIndex: 0,
    isConnectable: false,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    draggable: false,
    selectable: false,
    deletable: false,
    data: { elementId: "s", name: "Art", svgContent, showBorder, isSelected: false },
  };
  return render(
    <ReactFlowProvider>
      <SvgNode {...props} />
    </ReactFlowProvider>,
  );
}

function expectNeutralized(container: HTMLElement) {
  expect(container.querySelector("script")).toBeNull();
  expect(container.innerHTML.toLowerCase()).not.toContain("onload");
  expect(container.innerHTML.toLowerCase()).not.toContain("javascript:");
  expect(container.querySelector("#ok")).not.toBeNull();
}

describe("SVG rendering is sanitized", () => {
  it.each([true, false])("SvgNode neutralizes a hostile svgContent (showBorder=%s)", (border) => {
    const view = renderSvgNode(PAYLOAD, border);
    expectNeutralized(view.container);
  });

  it("SvgNode renders nothing for markup that is not an SVG", () => {
    const view = renderSvgNode("<img src=x onerror=alert(1)>", true);
    expect(view.container.querySelector("img")).toBeNull();
  });

  it("CustomIconRenderer neutralizes a hostile icon library entry", () => {
    const view = render(
      <CustomIconRenderer
        icon={{
          id: "i",
          name: "i",
          createdAt: 0,
          usageCount: 0,
          source: { kind: "svg", svgContent: PAYLOAD },
        }}
      />,
    );
    expectNeutralized(view.container);
  });

  it("keeps a clean SVG visually unchanged", () => {
    const clean =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect id="ok" fill="red"/></svg>';
    const view = renderSvgNode(clean, false);
    expect(view.container.querySelector("#ok")?.getAttribute("fill")).toBe("red");
    expect(view.container.querySelector("svg[viewBox]")).not.toBeNull();
    vi.restoreAllMocks();
  });
});
