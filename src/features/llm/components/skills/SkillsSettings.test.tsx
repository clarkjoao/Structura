import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/infrastructure/i18n";
import { downloadFile } from "@/lib/export-service/download-file";
import { useSkillStore } from "../../skills/skill-store";
import { memorySkillFolder, skillText } from "../../skills/test-utils";
import { SkillsSettings } from "./SkillsSettings";

vi.mock("../../hooks/useToolCatalog", () => ({
  useToolCatalog: () => [
    { name: "add_node", kind: "write" },
    { name: "get_node_details", kind: "read" },
  ],
}));

vi.mock("@/lib/export-service/download-file", () => ({ downloadFile: vi.fn() }));

const t = (key: string, params?: Record<string, unknown>) => i18n.t(key, params);

let folder: ReturnType<typeof memorySkillFolder>;

async function mount(): Promise<void> {
  render(<SkillsSettings />);
  await act(async () => {
    await useSkillStore.getState().load();
  });
}

beforeEach(async () => {
  localStorage.clear();
  folder = memorySkillFolder();
  useSkillStore.getState().setFolderHost(folder.host);
});

afterEach(() => {
  useSkillStore.getState().setFolderHost(null);
  vi.clearAllMocks();
});

describe("SkillsSettings", () => {
  it("lists skills with their source, and the switch enables or disables them", async () => {
    folder.files.set(".structura/skills/aws.md", skillText("AWS review"));
    await mount();

    const row = (await screen.findByText("AWS review")).closest("li")!;
    expect(within(row).getByText(t("llmChat.skills.source.workspace"))).toBeTruthy();
    const toggle = within(row).getByRole("switch", {
      name: t("llmChat.skills.settings.enable", { name: "AWS review" }),
    });
    expect(toggle.getAttribute("aria-checked")).toBe("true");

    await act(async () => {
      fireEvent.click(toggle);
    });
    await waitFor(() => expect(useSkillStore.getState().skills[0]?.enabled).toBe(false));
    // Enabling is personal: the shared file does not change.
    expect(folder.files.get(".structura/skills/aws.md")).toBe(skillText("AWS review"));
  });

  it("warns about tool names no tool has", async () => {
    folder.files.set(
      ".structura/skills/aws.md",
      skillText("AWS review", "tools: [get_node_details, made_up]\n"),
    );
    await mount();
    expect(
      await screen.findByRole("img", {
        name: t("llmChat.skills.settings.warningUnknownTools", { names: "made_up" }),
      }),
    ).toBeTruthy();
  });

  it("editing a workspace skill writes the file back", async () => {
    folder.files.set(".structura/skills/aws.md", skillText("AWS review"));
    await mount();

    fireEvent.click(await screen.findByRole("button", { name: t("llmChat.skills.settings.edit") }));
    fireEvent.change(screen.getByLabelText(t("llmChat.skills.settings.description")), {
      target: { value: "Better description" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: t("common.save") }));
    });

    await waitFor(() =>
      expect(folder.files.get(".structura/skills/aws.md")).toContain(
        "description: Better description",
      ),
    );
  });

  it("keeps the edit in the form when the write fails", async () => {
    folder.files.set(".structura/skills/aws.md", skillText("AWS review"));
    await mount();
    vi.spyOn(console, "error").mockImplementation(() => {});

    fireEvent.click(await screen.findByRole("button", { name: t("llmChat.skills.settings.edit") }));
    const description = screen.getByLabelText(t("llmChat.skills.settings.description"));
    fireEvent.change(description, { target: { value: "Unsaved" } });
    folder.setConnected(false);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: t("common.save") }));
    });

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(
      (screen.getByLabelText(t("llmChat.skills.settings.description")) as HTMLInputElement).value,
    ).toBe("Unsaved");
    expect(folder.files.get(".structura/skills/aws.md")).toBe(skillText("AWS review"));
  });

  it("shows a broken file's line and reason, with its path", async () => {
    folder.files.set(".structura/skills/broken.md", "---\nname: Broken\n---\n");
    await mount();
    const reason = t("llmChat.skills.settings.problemLine", {
      line: 1,
      reason: t("llmChat.skills.error.missingField", { field: "description" }),
    });
    expect(await screen.findByText(reason)).toBeTruthy();
    expect(
      screen.getByText(
        t("llmChat.skills.settings.filePath", { path: ".structura/skills/broken.md" }),
      ),
    ).toBeTruthy();
  });

  it("opens a broken local skill's raw text and saves the fix", async () => {
    useSkillStore.getState().setFolderHost(null);
    // A local skill whose text no longer parses (e.g. edited before limits changed).
    const created = await useSkillStore
      .getState()
      .createSkill("local", { name: "Local", description: "d", instructions: "i" });
    expect(created.ok).toBe(true);
    const id = useSkillStore.getState().skills[0]!.id;
    await useSkillStore.getState().saveRawText({ source: "local", id }, "---\nname: Local\n---\n");
    await mount();

    fireEvent.click(
      await screen.findByRole("button", { name: t("llmChat.skills.settings.showRaw") }),
    );
    fireEvent.change(screen.getByLabelText(t("llmChat.skills.settings.rawTitle")), {
      target: { value: skillText("Local") },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: t("common.save") }));
    });

    await waitFor(() => expect(useSkillStore.getState().problems).toEqual([]));
    expect(useSkillStore.getState().skills.map((skill) => skill.name)).toEqual(["Local"]);
  });

  it("creates a skill where the user chooses, with tools from the picker", async () => {
    await mount();
    fireEvent.click(screen.getByRole("button", { name: t("llmChat.skills.settings.new") }));
    fireEvent.click(screen.getByRole("button", { name: t("llmChat.skills.source.workspace") }));
    fireEvent.change(screen.getByLabelText(t("llmChat.skills.settings.name")), {
      target: { value: "Writer" },
    });
    fireEvent.change(screen.getByLabelText(t("llmChat.skills.settings.description")), {
      target: { value: "Adds things" },
    });
    expect(screen.getByText(t("llmChat.skills.settings.writeNote"))).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: t("llmChat.skills.settings.addTool") }));
    fireEvent.click(await screen.findByRole("button", { name: /add_node/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: t("common.save") }));
    });

    await waitFor(() =>
      expect(folder.files.get(".structura/skills/writer.md")).toBe(
        "---\nname: Writer\ndescription: Adds things\ntools: [add_node]\n---\n",
      ),
    );
  });

  it("asks before deleting, then deletes the workspace file", async () => {
    folder.files.set(".structura/skills/aws.md", skillText("AWS review"));
    await mount();
    fireEvent.click(
      await screen.findByRole("button", { name: t("llmChat.skills.settings.delete") }),
    );
    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText(
        t("llmChat.skills.settings.deleteWorkspace", { path: ".structura/skills/aws.md" }),
      ),
    ).toBeTruthy();
    expect(folder.files.has(".structura/skills/aws.md")).toBe(true);

    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole("button", { name: t("llmChat.skills.settings.confirmDelete") }),
      );
    });
    await waitFor(() => expect(folder.files.has(".structura/skills/aws.md")).toBe(false));
  });

  it("exports a skill as .md", async () => {
    folder.files.set(".structura/skills/aws.md", skillText("AWS review"));
    await mount();
    fireEvent.click(
      await screen.findByRole("button", { name: t("llmChat.skills.settings.export") }),
    );
    expect(downloadFile).toHaveBeenCalledWith(
      skillText("AWS review"),
      "aws-review.md",
      "text/markdown",
    );
  });

  it("imports .md files into the chosen source and reports broken ones", async () => {
    await mount();
    fireEvent.click(screen.getByRole("button", { name: t("llmChat.skills.settings.import") }));
    fireEvent.click(screen.getByRole("button", { name: t("llmChat.skills.source.local") }));

    const input = screen.getByLabelText(t("llmChat.skills.settings.import"), {
      selector: "input",
    });
    await act(async () => {
      fireEvent.change(input, {
        target: {
          files: [
            new File([skillText("Imported")], "imported.md", { type: "text/markdown" }),
            new File(["no front matter"], "bad.md", { type: "text/markdown" }),
          ],
        },
      });
    });

    await waitFor(() =>
      expect(useSkillStore.getState().skills.map((skill) => [skill.source, skill.name])).toEqual([
        ["local", "Imported"],
      ]),
    );
    expect(screen.getByText(t("llmChat.skills.settings.importDone", { count: 1 }))).toBeTruthy();
    expect(screen.getByText(/^bad\.md: /)).toBeTruthy();
  });
});
