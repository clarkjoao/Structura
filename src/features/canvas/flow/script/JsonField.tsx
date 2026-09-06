import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { LazyMonacoEditor, type EditorProps } from "@/lib/monaco/LazyMonacoEditor";
import { useTheme } from "@/hooks/useTheme";
import { parseJsonField } from "./stepContext";

/**
 * A body, edited as JSON.
 *
 * These fields hold example payloads — a request, a response, the shape a call
 * expects back — and they were plain textareas, so a nested object was typed
 * blind, without a bracket matched or a quote closed. The editor is the same
 * one the rest of the product already uses for JSON.
 *
 * It highlights and folds JSON; it does not require it. `payload` is free text
 * by design and some scripts hold prose there, so the field says when what it
 * holds will be read as text rather than refusing to hold it — the same stance
 * the reading takes with every contract it checks.
 */

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Sits above the editor, so a filled field still says what it is. */
  label: string;
  testId: string;
  /** Rows to show before the content asks for more. */
  minLines?: number;
}

const OPTIONS: EditorProps["options"] = {
  minimap: { enabled: false },
  fontSize: 11,
  lineNumbers: "off",
  lineDecorationsWidth: 4,
  lineNumbersMinChars: 0,
  glyphMargin: false,
  folding: true,
  foldingHighlight: false,
  scrollBeyondLastLine: false,
  wordWrap: "on",
  overviewRulerLanes: 0,
  overviewRulerBorder: false,
  hideCursorInOverviewRuler: true,
  renderLineHighlight: "none",
  scrollbar: { vertical: "auto", horizontal: "hidden", verticalScrollbarSize: 6 },
  automaticLayout: true,
  tabSize: 2,
  padding: { top: 6, bottom: 6 },
  contextmenu: false,
  quickSuggestions: false,
};

const LINE_HEIGHT = 17;
const CHROME = 14;

export function JsonField({ value, onChange, label, testId, minLines = 3 }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();

  const lines = Math.max(minLines, value.split("\n").length);
  const height = Math.min(220, lines * LINE_HEIGHT + CHROME);

  const parsed = useMemo(() => parseJsonField(value), [value]);
  const isText = value.trim().length > 0 && parsed === null;

  return (
    <div className="flex flex-col gap-1" onClick={(event) => event.stopPropagation()}>
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {parsed !== null && (
          <button
            type="button"
            data-testid={`${testId}-format`}
            onClick={() => onChange(JSON.stringify(parsed, null, 2))}
            className="text-[9px] text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("flowScript.jsonFormat")}
          </button>
        )}
      </div>
      <div
        data-testid={testId}
        className="overflow-hidden rounded border border-border bg-secondary"
        style={{ height }}
      >
        <LazyMonacoEditor
          language="json"
          theme={theme === "dark" ? "vs-dark" : "light"}
          height="100%"
          value={value}
          onChange={(next: string | undefined) => onChange(next ?? "")}
          options={OPTIONS}
          onMount={(editor: Parameters<NonNullable<EditorProps["onMount"]>>[0]) => {
            // The canvas listens for keys globally; typing a payload is not a
            // shortcut for anything.
            editor.getDomNode()?.addEventListener("keydown", (event: Event) => {
              event.stopPropagation();
            });
          }}
        />
      </div>
      {isText && (
        <span data-testid={`${testId}-not-json`} className="text-[9px] text-muted-foreground">
          {t("flowScript.jsonReadAsText")}
        </span>
      )}
    </div>
  );
}

export default JsonField;
