import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import "@/features/elements/bootstrap";
import i18n from "@/infrastructure/i18n";
import type { Component } from "@/features/diagram";
import UnknownElementPanel from "./UnknownElementPanel";

function renderWith(component: Component) {
  render(
    <ReactFlowProvider>
      <UnknownElementPanel
        component={component}
        onClose={vi.fn()}
        updateComponent={vi.fn()}
        removeComponent={vi.fn()}
      />
    </ReactFlowProvider>,
  );
}

const base = { id: "x", name: "X", description: "", technology: "", tags: [], parentId: null };

describe("UnknownElementPanel", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("says a removed type is no longer there, under a header naming it", () => {
    renderWith({ ...base, type: "sfn-state" } as unknown as Component);
    expect(screen.getByText("A type Structura no longer has")).toBeInTheDocument();
    expect(screen.getAllByText("sfn-state").length).toBeGreaterThan(0);
    // None of the generic fields that do not apply to it.
    expect(screen.queryByText("Technology")).toBeNull();
  });

  it("names the plugin a plugin type needs", () => {
    renderWith({ ...base, type: "acme/widget" } as unknown as Component);
    expect(screen.getByText("From a plugin that is not installed")).toBeInTheDocument();
    expect(screen.getByText(/The acme plugin draws this element/)).toBeInTheDocument();
  });

  it("shows an unknown component's own content, with a way to copy it", () => {
    renderWith({ ...base, type: "unknown", rawContent: "<raw/>" } as unknown as Component);
    expect(screen.getByText("Content kept as it came")).toBeInTheDocument();
    expect(screen.getByText("<raw/>")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy content" })).toBeInTheDocument();
  });
});
