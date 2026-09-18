import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import type { ComponentProps } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import NoteNode from "./NoteNode";

/**
 * A note on a read surface is read, not written: a click on its body does
 * not open the editor, and reaches the node — where the reader takes it as
 * focus. In the editor the same click opens the note for editing.
 */

type NoteProps = ComponentProps<typeof NoteNode>;

function renderNote(controlsDisabled: boolean) {
  const onNodeClick = vi.fn();
  const props = {
    id: "n",
    type: "note",
    selected: false,
    dragging: false,
    zIndex: 0,
    isConnectable: false,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    draggable: false,
    selectable: false,
    deletable: false,
    data: {
      elementId: "n",
      name: "Ledger",
      description: "Double-entry, immutable.",
      isSelected: false,
      controlsDisabled,
    },
  } as unknown as NoteProps;
  const view = render(
    <ReactFlowProvider>
      <div onClick={onNodeClick}>
        <NoteNode {...props} />
      </div>
    </ReactFlowProvider>,
  );
  fireEvent.click(view.getByText("Double-entry, immutable."));
  return { view, onNodeClick };
}

describe("a note's body click", () => {
  it("on a read surface, opens no editor and reaches the node", () => {
    const { view, onNodeClick } = renderNote(true);
    expect(view.container.querySelector("textarea")).toBeNull();
    expect(onNodeClick).toHaveBeenCalledTimes(1);
  });

  it("in the editor, opens the note for editing", () => {
    const { view, onNodeClick } = renderNote(false);
    expect(view.container.querySelector("textarea")).not.toBeNull();
    expect(onNodeClick).not.toHaveBeenCalled();
  });
});
