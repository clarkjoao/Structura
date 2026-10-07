import type { PluginEditorRename } from "../plugin.types";

/** The slice of a Monaco text model the rename provider uses. */
export interface RenameModel {
  getOffsetAt(position: { lineNumber: number; column: number }): number;
  getPositionAt(offset: number): { lineNumber: number; column: number };
}

type Position = { lineNumber: number; column: number };

/**
 * A Monaco rename provider (F2) for one plugin editor, driven by the plugin's
 * `PluginEditorRename`. Monaco registers rename providers per language, for every editor, so
 * this one answers only for its own model: for any other it returns null and Monaco asks the
 * next provider. The plugin applies the rename itself (it may span files), so the edits
 * returned to Monaco are empty.
 */
export function createRenameProvider<M extends RenameModel>(
  isOwnModel: (model: M) => boolean,
  getRename: () => PluginEditorRename | undefined,
  nothingToRename: () => string,
) {
  return {
    resolveRenameLocation(model: M, position: Position) {
      const rename = getRename();
      if (!isOwnModel(model) || !rename) return null;
      const symbol = rename.resolve(model.getOffsetAt(position));
      if (!symbol)
        return { range: emptyRange(position), text: "", rejectReason: nothingToRename() };
      const start = model.getPositionAt(symbol.start);
      const end = model.getPositionAt(symbol.end);
      return {
        range: {
          startLineNumber: start.lineNumber,
          startColumn: start.column,
          endLineNumber: end.lineNumber,
          endColumn: end.column,
        },
        text: symbol.text,
      };
    },

    async provideRenameEdits(model: M, position: Position, newName: string) {
      const rename = getRename();
      if (!isOwnModel(model) || !rename) return null;
      const refusal = await rename.rename(model.getOffsetAt(position), newName);
      return typeof refusal === "string" && refusal !== ""
        ? { edits: [], rejectReason: refusal }
        : { edits: [] };
    },
  };
}

const emptyRange = (p: Position) => ({
  startLineNumber: p.lineNumber,
  startColumn: p.column,
  endLineNumber: p.lineNumber,
  endColumn: p.column,
});
