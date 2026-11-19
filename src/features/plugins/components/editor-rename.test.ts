import { describe, expect, it, vi } from "vitest";
import { createRenameProvider, type RenameModel } from "./editor-rename";

/** A one-line model: offset n ↔ line 1, column n + 1. */
const model = (): RenameModel => ({
  getOffsetAt: (p) => p.column - 1,
  getPositionAt: (offset) => ({ lineNumber: 1, column: offset + 1 }),
});

describe("plugin editor rename provider", () => {
  const own = model();
  const other = model();
  const rename = {
    resolve: vi.fn((offset: number) =>
      offset >= 6 && offset < 9 ? { start: 6, end: 9, text: "foo" } : null,
    ),
    rename: vi.fn(async (_offset: number, name: string) =>
      name === "taken" ? "Already used" : undefined,
    ),
  };
  const provider = createRenameProvider(
    (m) => m === own,
    () => rename,
    () => "Nothing to rename",
  );

  it("resolves the plugin's symbol as a range in its own editor", () => {
    expect(provider.resolveRenameLocation(own, { lineNumber: 1, column: 8 })).toEqual({
      range: { startLineNumber: 1, startColumn: 7, endLineNumber: 1, endColumn: 10 },
      text: "foo",
    });
  });

  it("rejects where the plugin has no symbol, and stays out of other editors", () => {
    expect(provider.resolveRenameLocation(own, { lineNumber: 1, column: 1 })).toMatchObject({
      rejectReason: "Nothing to rename",
    });
    expect(provider.resolveRenameLocation(other, { lineNumber: 1, column: 8 })).toBeNull();
  });

  it("hands the rename to the plugin, passing its refusal back to the editor", async () => {
    expect(await provider.provideRenameEdits(own, { lineNumber: 1, column: 8 }, "bar")).toEqual({
      edits: [],
    });
    expect(rename.rename).toHaveBeenCalledWith(7, "bar");
    expect(await provider.provideRenameEdits(own, { lineNumber: 1, column: 8 }, "taken")).toEqual({
      edits: [],
      rejectReason: "Already used",
    });
    expect(
      await provider.provideRenameEdits(other, { lineNumber: 1, column: 8 }, "bar"),
    ).toBeNull();
  });
});
