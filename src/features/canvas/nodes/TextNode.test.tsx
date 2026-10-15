import { describe, expect, it } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import type { ComponentProps } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import TextNode, { TEXT_FONT_PX, type TextNodeData } from "./TextNode";

/**
 * Free text is edited where it stands: a double click opens it, a new empty one
 * opens by itself once selected, and a reader never gets the editor.
 */

type TextProps = ComponentProps<typeof TextNode>;

function renderText(data: Partial<TextNodeData>, selected = false) {
  const props = {
    id: "t",
    type: "text",
    selected,
    dragging: false,
    zIndex: 0,
    isConnectable: false,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    draggable: false,
    selectable: false,
    deletable: false,
    data: { elementId: "t", name: "Phase 1", ...data },
  } as unknown as TextProps;
  return render(
    <ReactFlowProvider>
      <TextNode {...props} />
    </ReactFlowProvider>,
  );
}

describe("TextNode", () => {
  it("draws its content with the chosen style", () => {
    const view = renderText({ textSize: "xl", bold: true, italic: true });
    const text = view.getByText("Phase 1");
    expect(text.style.fontSize).toBe(`${TEXT_FONT_PX.xl}px`);
    expect(text.style.fontWeight).toBe("700");
    expect(text.style.fontStyle).toBe("italic");
  });

  it("opens the editor on a double click", () => {
    const view = renderText({});
    expect(view.container.querySelector("textarea")).toBeNull();
    fireEvent.doubleClick(view.getByText("Phase 1"));
    expect(view.container.querySelector("textarea")).not.toBeNull();
  });

  it("gives a reader no editor", () => {
    const view = renderText({ controlsDisabled: true });
    fireEvent.doubleClick(view.getByText("Phase 1"));
    expect(view.container.querySelector("textarea")).toBeNull();
  });

  it("opens by itself when a new, empty text is selected", () => {
    const view = renderText({ name: "" }, true);
    expect(view.container.querySelector("textarea")).not.toBeNull();
  });

  it("does not open an empty text for a reader", () => {
    const view = renderText({ name: "", controlsDisabled: true }, true);
    expect(view.container.querySelector("textarea")).toBeNull();
  });
});
