import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Diagram } from "@/features/diagram";
import { EmbedModal } from "./EmbedModal";

const { generateViewerUrl, getViewerPostMessageUrl } = vi.hoisted(() => ({
  generateViewerUrl: vi.fn(() => "https://example.test/viewer#d=abc"),
  getViewerPostMessageUrl: vi.fn(() => "https://example.test/viewer"),
}));

vi.mock("@/lib/share-url", () => ({ generateViewerUrl, getViewerPostMessageUrl }));

function makeDiagram(name: string): Diagram {
  return {
    id: "d1",
    name,
    level: "container",
    createdAt: 0,
    updatedAt: 0,
    snapshot: { components: {}, connections: {}, flows: {}, iconLibrary: {} },
    nodeLayouts: {},
    edgeLayouts: {},
    folderId: null,
  } as Diagram;
}

describe("EmbedModal", () => {
  beforeEach(() => {
    generateViewerUrl.mockClear();
  });

  // The embed URL is an lz-string compression of the whole diagram. It used to be
  // computed in a useMemo keyed on the diagram object, and the modal is mounted
  // unconditionally, so every store mutation re-compressed the entire diagram with
  // the dialog closed and nobody looking at the result.
  it("does not build the viewer URL while closed", () => {
    const { rerender } = render(
      <EmbedModal open={false} onOpenChange={vi.fn()} diagram={makeDiagram("a")} />,
    );

    expect(generateViewerUrl).not.toHaveBeenCalled();

    act(() => {
      rerender(<EmbedModal open={false} onOpenChange={vi.fn()} diagram={makeDiagram("b")} />);
    });

    expect(generateViewerUrl).not.toHaveBeenCalled();
  });

  it("builds the viewer URL once the modal opens", () => {
    const diagram = makeDiagram("a");
    const { rerender } = render(
      <EmbedModal open={false} onOpenChange={vi.fn()} diagram={diagram} />,
    );
    expect(generateViewerUrl).not.toHaveBeenCalled();

    act(() => {
      rerender(<EmbedModal open onOpenChange={vi.fn()} diagram={diagram} />);
    });

    expect(generateViewerUrl).toHaveBeenCalledTimes(1);
  });

  it("shows the iframe snippet with the viewer URL when open", () => {
    render(<EmbedModal open onOpenChange={vi.fn()} diagram={makeDiagram("a")} />);

    const textarea = screen.getAllByRole("textbox")[0] as HTMLTextAreaElement;
    expect(textarea.value).toContain("https://example.test/viewer#d=abc");
    expect(textarea.value).toContain("<iframe");
  });
});
