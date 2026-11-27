import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import i18n from "@/infrastructure/i18n";
import Navbar from "./Navbar";

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

beforeEach(async () => {
  await i18n.changeLanguage("pt-BR");
});

describe("the nav entries", () => {
  it.each(["/", "/catalog", "/plugins", "/workspace/d-1"])("keep their order on %s", (pathname) => {
    at(pathname);

    const labels = screen
      .getAllByRole("link")
      .map((link) => link.textContent?.trim())
      .filter((label): label is string => Boolean(label));

    expect(labels.slice(1)).toEqual(["Workspaces", "Serviços", "Plugins"]);
  });
});
