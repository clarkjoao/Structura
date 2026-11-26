import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LazyMonacoEditor as Editor, type EditorProps } from "@/lib/monaco/LazyMonacoEditor";
import type { JsonViewerComponent, ComponentPatch } from "@/features/diagram";
import { CommitField, ElementScaffold, PanelSection } from "./shell";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import { jsonSyntaxError } from "../../nodes/JsonViewerNode/jsonOutline";

interface JsonViewerPanelProps {
  component: JsonViewerComponent;
  onClose: () => void;
  updateComponent: (id: string, patch: ComponentPatch) => void;
  removeComponent: (id: string) => void;
  focusTitleTrigger?: number;
  onFocusElement?: (componentId: string) => void;
}

function formatJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

const MONACO_OPTIONS = {
  minimap: { enabled: false },
  fontSize: 12,
  lineNumbers: "on" as const,
  scrollBeyondLastLine: false,
  wordWrap: "on" as const,
  folding: true,
  scrollbar: { vertical: "auto" as const, horizontal: "hidden" as const },
  overviewRulerLanes: 0,
  contextmenu: true,
  tabSize: 2,
};

export default function JsonViewerPanel({
  component,
  onClose,
  updateComponent,
  removeComponent,
  focusTitleTrigger = 0,
  onFocusElement,
}: JsonViewerPanelProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const editorTheme = theme === "dark" ? "vs-dark" : "light";
  const saved = formatJson(component.jsonContent ?? "{}");

  // The editor is always editable: a draft that differs from what is saved can be applied when it
  // parses, or discarded. No separate "edit mode" to enter first.
  const [draft, setDraft] = useState(saved);
  const dirty = draft !== saved;
  const error = useMemo(() => jsonSyntaxError(draft), [draft]);

  // Someone else (the canvas node, a collaborator) saved: follow it unless the author is mid-edit.
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(() => {
    if (!dirtyRef.current) setDraft(saved);
  }, [saved]);

  const apply = useCallback(() => {
    if (!dirty || error) return;
    const formatted = formatJson(draft);
    setDraft(formatted);
    updateComponent(component.id, { jsonContent: formatted });
  }, [component.id, dirty, draft, error, updateComponent]);
  const applyRef = useRef(apply);
  applyRef.current = apply;

  const discard = () => setDraft(saved);
  const format = () => {
    if (!error) setDraft(formatJson(draft));
  };

  return (
    <ElementScaffold
      component={component}
      onClose={onClose}
      updateComponent={updateComponent}
      removeComponent={removeComponent}
      onFocusElement={onFocusElement}
      focusTitleTrigger={focusTitleTrigger}
      namePlaceholder={t("jsonViewer.unnamed")}
    >
      <PanelSection title={t("panelShell.sectionWhat")}>
        <CommitField
          label={t("jsonViewer.schemaRef")}
          value={component.schemaRef ?? ""}
          addLabel={t("jsonViewer.schemaRef")}
          placeholder={t("jsonViewer.schemaRefPlaceholder")}
          onCommit={(value) =>
            updateComponent(component.id, { schemaRef: value.trim() === "" ? undefined : value })
          }
        />

        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {t("jsonViewer.jsonContent")}
            </span>
            <button
              type="button"
              onClick={format}
              disabled={!!error}
              className="rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
            >
              {t("jsonViewer.format")}
            </button>
          </div>

          <div
            className={cn(
              "overflow-hidden rounded-t-md border",
              error ? "border-destructive/60" : dirty ? "border-primary/50" : "border-border",
            )}
            style={{ height: 320 }}
          >
            <Editor
              height="100%"
              language="json"
              theme={editorTheme}
              value={draft}
              onChange={(value: Parameters<NonNullable<EditorProps["onChange"]>>[0]) =>
                setDraft(value ?? "")
              }
              options={MONACO_OPTIONS}
              onMount={(editor: Parameters<NonNullable<EditorProps["onMount"]>>[0]) => {
                editor.getDomNode()?.addEventListener("keydown", (keyboardEvent: Event) => {
                  keyboardEvent.stopPropagation();
                  if (
                    keyboardEvent instanceof KeyboardEvent &&
                    keyboardEvent.key === "Enter" &&
                    (keyboardEvent.metaKey || keyboardEvent.ctrlKey)
                  ) {
                    keyboardEvent.preventDefault();
                    applyRef.current();
                  }
                });
              }}
            />
          </div>

          {/* The status line: what the draft is, and what can be done with it. */}
          <div
            role="status"
            data-testid="json-status"
            className={cn(
              "flex items-center gap-2 rounded-b-md border border-t-0 px-2.5 py-1.5 text-[11px]",
              error ? "border-destructive/60 bg-destructive/5" : "border-border bg-secondary/40",
            )}
          >
            <span
              className={cn("min-w-0 flex-1", error ? "text-destructive" : "text-muted-foreground")}
              title={error?.message}
            >
              {error
                ? error.line
                  ? t("jsonViewer.errorAt", { line: error.line, column: error.column })
                  : t("jsonViewer.invalidShort")
                : dirty
                  ? t("jsonViewer.unsaved")
                  : t("jsonViewer.valid")}
            </span>
            {dirty && (
              <>
                <button
                  type="button"
                  onClick={discard}
                  className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  {t("jsonViewer.discard")}
                </button>
                <button
                  type="button"
                  onClick={apply}
                  disabled={!!error}
                  title={t("jsonViewer.applyHint")}
                  className="rounded bg-primary px-2 py-0.5 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
                >
                  {t("jsonViewer.apply")}
                </button>
              </>
            )}
          </div>
        </div>
      </PanelSection>
    </ElementScaffold>
  );
}
