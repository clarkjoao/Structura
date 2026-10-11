import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { OnMount } from "@monaco-editor/react";
import { LazyMonacoDiffEditor, LazyMonacoEditor } from "@/lib/monaco/LazyMonacoEditor";
import { useTheme } from "@/hooks/useTheme";
import type { PluginCodeEditorProps, PluginEditorMarker } from "../plugin.types";
import { createRenameProvider } from "./editor-rename";
import { KEY, keyMatchesLetter } from "@/lib/core/keyboard";

type Editor = Parameters<OnMount>[0];
type Monaco = Parameters<OnMount>[1];

const MARKER_OWNER = "structura-plugin";

function applyMarkers(editor: Editor, monaco: Monaco, markers: readonly PluginEditorMarker[]) {
  const model = editor.getModel();
  if (!model) return;
  const severity = {
    error: monaco.MarkerSeverity.Error,
    warning: monaco.MarkerSeverity.Warning,
    info: monaco.MarkerSeverity.Info,
  } as const;
  monaco.editor.setModelMarkers(
    model,
    MARKER_OWNER,
    markers
      .filter((m) => Number.isFinite(m.line) && m.line >= 1)
      .map((m) => {
        const line = Math.min(m.line, model.getLineCount());
        return {
          startLineNumber: line,
          endLineNumber: line,
          startColumn: 1,
          endColumn: model.getLineMaxColumn(line),
          message: String(m.message),
          severity: severity[m.severity] ?? monaco.MarkerSeverity.Info,
        };
      }),
  );
}

const OPTIONS = {
  minimap: { enabled: false },
  fontSize: 12,
  scrollBeyondLastLine: false,
  tabSize: 2,
  automaticLayout: true,
} as const;

/** Moves the cursor to a 1-based line (clamped) and scrolls it into view. */
function revealLineIn(editor: Editor, line: number) {
  const model = editor.getModel();
  if (!model || !Number.isFinite(line)) return;
  const at = Math.min(Math.max(1, Math.floor(line)), model.getLineCount());
  editor.setPosition({ lineNumber: at, column: 1 });
  editor.revealLineInCenterIfOutsideViewport(at);
}

/**
 * The host's code editor as plugins get it (`api.ui.CodeEditor`, API 1.4): Monaco, lazily
 * loaded, following the app theme, with line markers, a save shortcut, (API 1.5) F2 rename and
 * (API 1.11) a model per file, line navigation and a side-by-side comparison.
 */
export function PluginCodeEditor(props: PluginCodeEditorProps) {
  return props.original === undefined ? (
    <SingleEditor {...props} />
  ) : (
    <ComparisonEditor {...props} original={props.original} />
  );
}

function SingleEditor({
  value,
  language,
  onChange,
  onSave,
  readOnly,
  markers = [],
  height = "100%",
  rename,
  path,
  revealLine,
  onCursorLine,
}: PluginCodeEditorProps) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const renameRef = useRef(rename);
  renameRef.current = rename;
  const nothingToRename = useRef("");
  nothingToRename.current = t("plugins.editor.nothingToRename");
  const renameProvider = useRef<{ dispose(): void } | null>(null);
  useEffect(() => () => renameProvider.current?.dispose(), []);
  const mounted = useRef<{ editor: Editor; monaco: Monaco } | null>(null);
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  const cursorRef = useRef(onCursorLine);
  cursorRef.current = onCursorLine;
  const revealRef = useRef(revealLine);
  revealRef.current = revealLine;

  useEffect(() => {
    if (mounted.current) applyMarkers(mounted.current.editor, mounted.current.monaco, markers);
  }, [markers, value, path]);

  // After the model of `path` is in place (Monaco's own effects run first), so the line is
  // the one of this file.
  useEffect(() => {
    if (mounted.current && revealLine) revealLineIn(mounted.current.editor, revealLine.line);
  }, [revealLine?.token]); // eslint-disable-line react-hooks/exhaustive-deps

  const wrapper = useSaveShortcut(saveRef);

  return (
    // `nokey`: React Flow's marker for "keys typed here are not canvas shortcuts". Monaco's
    // native edit context is a plain div, which React Flow does not see as an input, so without
    // it Space (pan) is swallowed and Delete/Backspace could reach the selected elements.
    <div ref={wrapper} className="nokey h-full w-full">
      <LazyMonacoEditor
        height={height}
        language={language}
        value={value}
        // A model per file: its own undo history, cursor and scroll. Kept when the editor
        // unmounts, so closing and reopening the plugin's pane does not lose the history.
        path={path}
        keepCurrentModel={path !== undefined}
        theme={theme === "dark" ? "vs-dark" : "light"}
        onChange={(next) => onChange?.(next ?? "")}
        onMount={(editor, monaco) => {
          mounted.current = { editor, monaco };
          // A model kept from before holds the text it had then.
          const model = editor.getModel();
          if (model && model.getValue() !== value) {
            editor.executeEdits("", [{ range: model.getFullModelRange(), text: value }]);
            editor.pushUndoStop();
          }
          applyMarkers(editor, monaco, markers);
          if (revealRef.current) revealLineIn(editor, revealRef.current.line);
          // The user's moves only: not `revealLine` (source "api"), nor a new value or model.
          editor.onDidChangeCursorPosition((event) => {
            if (
              event.source === "api" ||
              event.reason === monaco.editor.CursorChangeReason.ContentFlush
            )
              return;
            cursorRef.current?.(event.position.lineNumber);
          });
          renameProvider.current?.dispose();
          renameProvider.current = monaco.languages.registerRenameProvider(
            language ?? "plaintext",
            createRenameProvider(
              (model) => model === editor.getModel(),
              () => renameRef.current,
              () => nothingToRename.current,
            ),
          );
        }}
        options={{ ...OPTIONS, readOnly }}
      />
    </div>
  );
}

/**
 * `original` on the left, read-only; `value` on the right, editable — on the same model as the
 * single editor of `path`, so its undo history carries over both ways.
 */
function ComparisonEditor({
  value,
  original,
  language,
  onChange,
  onSave,
  readOnly,
  height = "100%",
  path,
}: PluginCodeEditorProps & { original: string }) {
  const { theme } = useTheme();
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const wrapper = useSaveShortcut(saveRef);
  // Monaco throws when a model is disposed before the diff editor showing it, which is the
  // order the wrapper uses: it keeps both models, and they are disposed here once the editor is
  // gone — all but the model of `path`, which the single editor goes on with.
  const models = useRef<Array<{ dispose(): void }>>([]);
  useEffect(
    () => () => {
      const owned = models.current;
      setTimeout(() => owned.forEach((model) => model.dispose()), 0);
    },
    [],
  );
  return (
    <div ref={wrapper} className="nokey h-full w-full">
      <LazyMonacoDiffEditor
        height={height}
        language={language}
        original={original}
        modified={value}
        modifiedModelPath={path}
        keepCurrentModifiedModel
        keepCurrentOriginalModel
        theme={theme === "dark" ? "vs-dark" : "light"}
        onMount={(editor) => {
          const shown = editor.getModel();
          if (shown) models.current = path ? [shown.original] : [shown.original, shown.modified];
          const modified = editor.getModifiedEditor();
          modified.onDidChangeModelContent(() => changeRef.current?.(modified.getValue()));
          // Opens on the first difference — it may be far down the file — once it is computed.
          if (editor.getLineChanges()) editor.revealFirstDiff();
          else {
            const first = editor.onDidUpdateDiff(() => {
              first.dispose();
              editor.revealFirstDiff();
            });
          }
        }}
        // Side by side when there is room, one column with both texts interleaved when not.
        options={{ ...OPTIONS, readOnly, originalEditable: false }}
      />
    </div>
  );
}

/**
 * Ctrl/Cmd+S inside the editor saves the plugin's document. The canvas claims the same
 * shortcut (save the workspace to its folder) in a document capture listener, so this one
 * listens on window, which captures first, and only for keys typed in this editor.
 */
function useSaveShortcut(saveRef: { current: (() => void) | undefined }) {
  const wrapper = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!saveRef.current || !(event.metaKey || event.ctrlKey) || !keyMatchesLetter(event, KEY.S))
        return;
      if (!(event.target instanceof Node) || !wrapper.current?.contains(event.target)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      saveRef.current();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [saveRef]);
  return wrapper;
}
