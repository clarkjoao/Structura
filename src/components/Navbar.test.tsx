import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import i18n from "@/infrastructure/i18n";
import Navbar from "./Navbar";

let enabled = true;
vi.mock("@/features/walkthrough/config", () => ({
  get WALKTHROUGH_ENABLED() {
    return enabled;
  },
}));

vi.mock("@/infrastructure/persistence", () => ({
  useFileSystemSync: () => {},
  isFileSystemSupported: false,
}));

vi.mock("./FileSystemStatus", () => ({ FileSystemStatus: () => null }));
vi.mock("./SettingsMenu", () => ({ SettingsMenu: () => null }));

function at(pathname: string) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <Navbar />
    </MemoryRouter>,
  );
}

const workflowsLink = () => screen.queryByRole("link", { name: "Workflows" });

beforeEach(async () => {
  await i18n.changeLanguage("pt-BR");
  enabled = true;
});

describe("the workflows entry", () => {
  // It used to come from a `showWalkthroughs` prop, so it appeared only on the
  // pages that remembered to pass it and vanished on the rest.
  it.each(["/", "/catalog", "/plugins", "/workflows", "/workspace/d-1"])(
    "is there on %s",
    (pathname) => {
      at(pathname);

      expect(workflowsLink()).not.toBeNull();
    },
  );

  it("points at /workflows", () => {
    at("/catalog");

    expect(workflowsLink()?.getAttribute("href")).toBe("/workflows");
  });

  it("reads as current while anywhere under a workflow", () => {
    at("/workflow/wt_1/step/0");

    expect(workflowsLink()?.className).toContain("font-medium");
  });

  it("does not read as current from another section", () => {
    at("/catalog");

    expect(workflowsLink()?.className).not.toContain("font-medium");
  });

  it("is absent everywhere when the feature is off", () => {
    enabled = false;

    for (const pathname of ["/", "/catalog", "/plugins"]) {
      const { unmount } = at(pathname);
      expect(workflowsLink()).toBeNull();
      unmount();
    }
  });
});

describe("the other entries keep their places", () => {
  it("orders workflows next to workspaces, ahead of the tooling", () => {
    at("/");

    const labels = screen
      .getAllByRole("link")
      .map((link) => link.textContent?.trim())
      .filter((label): label is string => Boolean(label));

    // Workspaces and Workflows are content the user authors; Registry and
    // Plugins are tooling.
    expect(labels.slice(1)).toEqual(["Workspaces", "Workflows", "Serviços", "Plugins"]);
  });
});
