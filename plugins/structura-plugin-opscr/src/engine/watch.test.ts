import { describe, expect, it } from "vitest";
import { changedFiles, mergeDisk, resolveConflict, toStats } from "./watch";

const tracked = (name: string) => name.endsWith(".yaml") || name === "opscr.layout.json";

describe("changedFiles", () => {
  it("names new, changed and removed tracked files only", () => {
    const known = toStats([
      { name: "a.yaml", lastModified: 1, size: 3 },
      { name: "b.yaml", lastModified: 1, size: 3 },
      { name: "gone.yaml", lastModified: 1, size: 1 },
    ]);
    const now = [
      { name: "a.yaml", lastModified: 1, size: 3 },
      { name: "b.yaml", lastModified: 2, size: 3 },
      { name: "new.yaml", lastModified: 1, size: 1 },
      { name: "notes.md", lastModified: 9, size: 9 },
    ];
    expect(changedFiles(known, now, tracked)).toEqual({
      read: ["b.yaml", "new.yaml"],
      removed: ["gone.yaml"],
    });
  });
});

describe("mergeDisk", () => {
  const clean = { name: "a.yaml", disk: "a1", text: "a1" };
  const dirty = { name: "b.yaml", disk: "b1", text: "b-mine" };

  it("reloads a clean file and ignores our own save", () => {
    const merged = mergeDisk([clean, dirty], { "a.yaml": "a2", "b.yaml": "b1" }, []);
    expect(merged.buffers).toEqual([
      { ...clean, disk: "a2", text: "a2", conflict: undefined },
      dirty,
    ]);
    expect(merged.reloaded).toEqual(["a.yaml"]);
    expect(merged.conflicts).toEqual([]);
  });

  it("never overwrites an unsaved edit: the disk text becomes a conflict", () => {
    const merged = mergeDisk([dirty], { "b.yaml": "b2" }, []);
    expect(merged.buffers).toEqual([{ ...dirty, conflict: "b2" }]);
    expect(merged.conflicts).toEqual(["b.yaml"]);
  });

  it("drops the conflict when the disk goes back to the text the edit started from", () => {
    const conflicted = { ...dirty, conflict: "b2" };
    const merged = mergeDisk([conflicted], { "b.yaml": "b1" }, []);
    expect(merged.buffers).toEqual([{ ...dirty, conflict: undefined }]);
    expect(merged.conflicts).toEqual([]);
  });

  it("settles when the disk already holds the user's text", () => {
    expect(mergeDisk([dirty], { "b.yaml": "b-mine" }, []).buffers).toEqual([
      { ...dirty, disk: "b-mine", conflict: undefined },
    ]);
  });

  it("adds new files, drops clean removed ones, keeps dirty removed ones to save again", () => {
    const merged = mergeDisk([clean, dirty], { "c.yaml": "c" }, ["a.yaml", "b.yaml"]);
    expect(merged.buffers).toEqual([
      { ...dirty, disk: "" },
      { name: "c.yaml", disk: "c", text: "c" },
    ]);
    expect(merged.reloaded).toEqual(["a.yaml", "c.yaml"]);
  });

  it("lets the disk win for machine-written files, even over unsaved text", () => {
    const layout = { name: "opscr.layout.json", disk: "{1}", text: "{2}" };
    const merged = mergeDisk(
      [layout],
      { "opscr.layout.json": "{3}" },
      [],
      (n) => n === layout.name,
    );
    expect(merged.buffers).toEqual([{ ...layout, disk: "{3}", text: "{3}", conflict: undefined }]);
    expect(merged.conflicts).toEqual([]);
  });

  it("keeps a buffer for machine-written files removed from disk", () => {
    const layout = { name: "opscr.layout.json", disk: "{}", text: "{}" };
    const merged = mergeDisk([layout], {}, ["opscr.layout.json"], (n) => n === "opscr.layout.json");
    expect(merged.buffers).toEqual([{ ...layout, disk: "", text: "", conflict: undefined }]);
  });
});

describe("resolveConflict", () => {
  const conflicted = { name: "b.yaml", disk: "b1", text: "mine", conflict: "theirs" };
  it("takes the disk text, or keeps mine over the new disk text", () => {
    expect(resolveConflict(conflicted, "disk")).toEqual({
      name: "b.yaml",
      disk: "theirs",
      text: "theirs",
    });
    expect(resolveConflict(conflicted, "mine")).toEqual({
      name: "b.yaml",
      disk: "theirs",
      text: "mine",
    });
  });
});
