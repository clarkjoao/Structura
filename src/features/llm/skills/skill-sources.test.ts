import { describe, expect, it } from "vitest";
import { InMemoryAdapter } from "@/infrastructure/persistence";
import {
  createLocalSkillSource,
  createSkillSourceRegistry,
  createWorkspaceSkillSource,
} from "./skill-sources";
import { memorySkillFolder, skillText } from "./test-utils";

describe("workspace skill source", () => {
  it("lists only the .md files in .structura/skills, with their path as id", async () => {
    const folder = memorySkillFolder();
    folder.files.set(".structura/skills/aws.md", skillText("AWS"));
    folder.files.set(".structura/skills/notes.txt", "ignored");
    folder.files.set(".structura/other.md", skillText("Elsewhere"));
    const source = createWorkspaceSkillSource(folder.host, new InMemoryAdapter());

    const files = await source.list();
    expect(files).toEqual([
      {
        id: ".structura/skills/aws.md",
        path: ".structura/skills/aws.md",
        text: skillText("AWS"),
        enabled: true,
      },
    ]);
  });

  it("creates, reads, updates and deletes files", async () => {
    const folder = memorySkillFolder();
    const source = createWorkspaceSkillSource(folder.host, new InMemoryAdapter());

    const created = await source.create(skillText("Revisão AWS"), "Revisão AWS");
    expect(created.id).toBe(".structura/skills/revisao-aws.md");
    // A second skill with the same name gets its own file.
    const second = await source.create(skillText("Revisão AWS"), "Revisão AWS");
    expect(second.id).toBe(".structura/skills/revisao-aws-2.md");

    await source.update(created.id, skillText("Changed"));
    expect(folder.files.get(created.id)).toBe(skillText("Changed"));
    expect((await source.read(created.id))?.text).toBe(skillText("Changed"));

    await source.delete(created.id);
    expect(folder.files.has(created.id)).toBe(false);
    expect(await source.read(created.id)).toBeNull();
  });

  it("picks up a change made outside the app on the next list", async () => {
    const folder = memorySkillFolder();
    const source = createWorkspaceSkillSource(folder.host, new InMemoryAdapter());
    expect(await source.list()).toEqual([]);

    // e.g. a git pull, or an editor.
    folder.files.set(".structura/skills/pulled.md", skillText("Pulled"));
    expect((await source.list()).map((file) => file.id)).toEqual([".structura/skills/pulled.md"]);

    folder.files.set(".structura/skills/pulled.md", skillText("Edited"));
    expect((await source.list())[0]?.text).toBe(skillText("Edited"));
  });

  it("keeps the enabled flag per user, keyed by workspace and path", async () => {
    const folder = memorySkillFolder("repo-a");
    const port = new InMemoryAdapter();
    folder.files.set(".structura/skills/a.md", skillText("A"));
    const source = createWorkspaceSkillSource(folder.host, port);

    await source.setEnabled(".structura/skills/a.md", false);
    expect((await source.list())[0]?.enabled).toBe(false);
    // The file itself is untouched: enabling is not part of the shared definition.
    expect(folder.files.get(".structura/skills/a.md")).toBe(skillText("A"));
    expect(await port.load("llm-skills:workspace-enabled:repo-a")).toEqual({
      ".structura/skills/a.md": false,
    });

    // Another workspace with the same path has its own state.
    const other = memorySkillFolder("repo-b");
    other.files.set(".structura/skills/a.md", skillText("A"));
    expect((await createWorkspaceSkillSource(other.host, port).list())[0]?.enabled).toBe(true);
  });

  it("surfaces a write failure", async () => {
    const folder = memorySkillFolder();
    const source = createWorkspaceSkillSource(folder.host, new InMemoryAdapter());
    const created = await source.create(skillText("A"), "A");
    folder.setConnected(false);
    await expect(source.update(created.id, skillText("B"))).rejects.toThrow("disconnected");
  });
});

describe("local skill source", () => {
  it("stores skills through the storage port", async () => {
    const port = new InMemoryAdapter();
    const source = createLocalSkillSource(port);

    const created = await source.create(skillText("Local"), "Local");
    expect(await source.list()).toEqual([
      { id: created.id, text: skillText("Local"), enabled: true },
    ]);

    await source.setEnabled(created.id, false);
    await source.update(created.id, skillText("Edited"));
    expect(await source.read(created.id)).toEqual({
      id: created.id,
      text: skillText("Edited"),
      enabled: false,
    });

    await source.delete(created.id);
    expect(await source.list()).toEqual([]);
    expect(await port.keys()).toEqual(["llm-skills:local:__ids"]);
  });
});

describe("source registry", () => {
  it("registers the workspace source only while a folder is connected", () => {
    const folder = memorySkillFolder();
    const port = new InMemoryAdapter();
    const sourcesOf = () =>
      createSkillSourceRegistry(port, folder.host)
        .list()
        .map((source) => source.source);

    expect(sourcesOf()).toEqual(["workspace", "local"]);
    folder.setConnected(false);
    expect(sourcesOf()).toEqual(["local"]);
    expect(
      createSkillSourceRegistry(port, null)
        .list()
        .map((source) => source.source),
    ).toEqual(["local"]);
  });
});
