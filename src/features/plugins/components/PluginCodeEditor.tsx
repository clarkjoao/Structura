import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { OnMount } from "@monaco-editor/react";
import { LazyMonacoEditor } from "@/lib/monaco/LazyMonacoEditor";
import { useTheme } from "@/hooks/useTheme";
import type { PluginCodeEditorProps, PluginEditorMarker } from "../plugin.types";
import { createRenameProvider } from "./editor-rename";

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

/**
 * The host's code editor as plugins get it (`api.ui.CodeEditor`, API 1.4): Monaco, lazily
 * loaded, following the app theme, with line markers, a save shortcut and (API 1.5) F2 rename.
 */
export function PluginCodeEditor({
  value,
  language,
  onChange,
  onSave,
  readOnly,
  markers = [],
  height = "100%",
  rename,
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

  useEffect(() => {
    if (mounted.current) applyMarkers(mounted.current.editor, mounted.current.monaco, markers);
  }, [markers, value]);

  // Ctrl/Cmd+S inside the editor saves the plugin's document. The canvas claims the same
  // shortcut (save the workspace to its folder) in a document capture listener, so this one
  // listens on window, which captures first, and only for keys typed in this editor.
  const wrapper = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!saveRef.current || !(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "s")
        return;
      if (!(event.target instanceof Node) || !wrapper.current?.contains(event.target)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      saveRef.current();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  return (
    <div ref={wrapper} className="h-full w-full">
      <LazyMonacoEditor
        height={height}
        language={language}
        value={value}
        theme={theme === "dark" ? "vs-dark" : "light"}
        onChange={(next) => onChange?.(next ?? "")}
        onMount={(editor, monaco) => {
          mounted.current = { editor, monaco };
          applyMarkers(editor, monaco, markers);
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
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 12,
          scrollBeyondLastLine: false,
          tabSize: 2,
          automaticLayout: true,
        }}
      />
    </div>
  );
}
