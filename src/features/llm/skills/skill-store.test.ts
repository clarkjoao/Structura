import { describe, expect, it, vi } from "vitest";
import { InMemoryAdapter } from "@/infrastructure/persistence";
import { createSkillStore, findSkill } from "./skill-store";
import { memorySkillFolder, skillText } from "./test-utils";

function setup() {
  const folder = memorySkillFolder();
  const port = new InMemoryAdapter();
  const store = createSkillStore(port, {});
  return { folder, port, store };
}

describe("skill store", () => {
  it("merges both sources; the same name appears once per source", async () => {
    const { folder, store } = setup();
    await store.getState().createSkill("local", {
      name: "Review",
      description: "Local copy",
      instructions: "Local",
    });
    folder.files.set(".structura/skills/review.md", skillText("Review"));
    store.getState().setFolderHost(folder.host);
    await store.getState().load();

    const { skills, availableSources } = store.getState();
    expect(availableSources).toEqual(["workspace", "local"]);
    expect(skills.map((skill) => [skill.source, skill.name])).toEqual([
      ["workspace", "Review"],
      ["local", "Review"],
    ]);
    expect(skills[0]?.path).toBe(".structura/skills/review.md");
  });

  it("keeps parse errors per file and never throws", async () => {
    const { folder, store } = setup();
    folder.files.set(".structura/skills/good.md", skillText("Good"));
    folder.files.set(".structura/skills/broken.md", "---\nname: Broken\n---\n");
    store.getState().setFolderHost(folder.host);
    await store.getState().load();

    const { skills, problems } = store.getState();
    expect(skills.map((skill) => skill.name)).toEqual(["Good"]);
    expect(problems).toEqual([
      {
        key: "workspace:.structura/skills/broken.md",
        source: "workspace",
        id: ".structura/skills/broken.md",
        path: ".structura/skills/broken.md",
        text: "---\nname: Broken\n---\n",
        error: { line: 1, code: "missingField", field: "description" },
      },
    ]);
  });

  it("keeps the workspace enabled state per user, outside the file", async () => {
    const { folder, store } = setup();
    folder.files.set(".structura/skills/a.md", skillText("A"));
    store.getState().setFolderHost(folder.host);
    await store.getState().load();

    const skill = store.getState().skills[0];
    expect(skill?.enabled).toBe(true);
    await store.getState().setEnabled(skill!, false);
    await store.getState().load();

    expect(store.getState().skills[0]?.enabled).toBe(false);
    expect(folder.files.get(".structura/skills/a.md")).toBe(skillText("A"));
  });

  it("writes an edited workspace skill back to its file", async () => {
    const { folder, store } = setup();
    folder.files.set(".structura/skills/a.md", skillText("A"));
    store.getState().setFolderHost(folder.host);
    await store.getState().load();

    const result = await store.getState().updateSkill(store.getState().skills[0]!, {
      name: "A",
      description: "Better",
      instructions: "New body",
      tools: ["get_node_details"],
    });
    expect(result.ok).toBe(true);
    expect(folder.files.get(".structura/skills/a.md")).toBe(
      "---\nname: A\ndescription: Better\ntools: [get_node_details]\n---\nNew body\n",
    );
    expect(store.getState().skills[0]?.description).toBe("Better");
  });

  it("returns a failed write instead of throwing, and leaves the file alone", async () => {
    const { folder, store } = setup();
    folder.files.set(".structura/skills/a.md", skillText("A"));
    store.getState().setFolderHost(folder.host);
    await store.getState().load();
    const skill = store.getState().skills[0]!;

    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(folder.host, "writeFile").mockRejectedValueOnce(new Error("permission denied"));
    const result = await store.getState().updateSkill(skill, {
      name: "A",
      description: "B",
      instructions: "C",
    });
    expect(result).toEqual({ ok: false, message: "permission denied" });
    expect(folder.files.get(".structura/skills/a.md")).toBe(skillText("A"));
    vi.restoreAllMocks();
  });

  it("rejects fields over the limits before writing", async () => {
    const { store } = setup();
    const result = await store.getState().createSkill("local", {
      name: "n".repeat(61),
      description: "B",
      instructions: "C",
    });
    expect(result).toMatchObject({ ok: false, parseError: { code: "tooLong", field: "name" } });
    expect(store.getState().skills).toEqual([]);
  });

  it("imports valid files and reports broken ones", async () => {
    const { store } = setup();
    const results = await store.getState().importFiles(
      [
        { name: "ok.md", text: skillText("Imported", "tools: [search_elements]\n") },
        { name: "bad.md", text: "no front matter" },
      ],
      "local",
    );
    expect(results.map((entry) => [entry.fileName, entry.result.ok])).toEqual([
      ["ok.md", true],
      ["bad.md", false],
    ]);
    expect(store.getState().skills.map((skill) => [skill.name, skill.tools])).toEqual([
      ["Imported", ["search_elements"]],
    ]);
  });

  it("drops the workspace source when the folder is disconnected", async () => {
    const { folder, store } = setup();
    folder.files.set(".structura/skills/a.md", skillText("A"));
    store.getState().setFolderHost(folder.host);
    await store.getState().load();
    expect(store.getState().skills).toHaveLength(1);

    folder.setConnected(false);
    await store.getState().load();
    expect(store.getState().skills).toEqual([]);
    expect(store.getState().availableSources).toEqual(["local"]);
  });

  it("finds a stored ref's skill by source and id", async () => {
    const { store } = setup();
    await store.getState().createSkill("local", { name: "A", description: "B", instructions: "" });
    const skill = store.getState().skills[0]!;
    expect(findSkill(store.getState().skills, { id: skill.id, source: "local", name: "x" })).toBe(
      skill,
    );
    expect(
      findSkill(store.getState().skills, { id: skill.id, source: "workspace", name: "A" }),
    ).toBeUndefined();
  });
});
