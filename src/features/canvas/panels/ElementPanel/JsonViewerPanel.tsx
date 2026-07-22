import { useState, useMemo, useEffect, useRef } from "react";
import debounce from "lodash.debounce";
import { X, Trash2, Braces } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LazyMonacoEditor as Editor, type EditorProps } from "@/lib/monaco/LazyMonacoEditor";
import type { JsonViewerComponent, ComponentPatch } from "@/features/diagram";
import { useActiveDiagram } from "@/features/diagram";
import TabBar, { type Tab } from "./components/TabBar";
import { ComponentIconTab } from "./components/ComponentIconTab";
import { FIELD_DEBOUNCE_MS } from "@/features/canvas/canvas.constants";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";

interface JsonViewerPanelProps {
  component: JsonViewerComponent;
  onClose: () => void;
  updateComponent: (id: string, patch: ComponentPatch) => void;
  removeComponent: (id: string) => void;
  focusTitleTrigger?: number;
}

function isValidJson(raw: string): boolean {
  try {
    JSON.parse(raw);
    return true;
  } catch {
    return false;
  }
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
}: JsonViewerPanelProps) {
  const { t } = useTranslation();
  const activeDiagram = useActiveDiagram();
  const { theme } = useTheme();
  const titleInputRef = useRef<HTMLInputElement>(null);
  const editorTheme = theme === "dark" ? "vs-dark" : "light";

  useEffect(() => {
    if (focusTitleTrigger > 0) {
      requestAnimationFrame(() => {
        titleInputRef.current?.focus();
        titleInputRef.current?.select();
      });
    }
  }, [focusTitleTrigger]);

  const [tab, setTab] = useState<Tab>("details");
  const [name, setName] = useState(component.name);
  const [schemaRef, setSchemaRef] = useState(component.schemaRef ?? "");
  const [jsonDraft, setJsonDraft] = useState(() => formatJson(component.jsonContent ?? "{}"));
  const [parseError, setParseError] = useState(false);
  const [isEditingJson, setIsEditingJson] = useState(false);

  useEffect(() => {
    setTab("details");
    setName(component.name);
    setSchemaRef(component.schemaRef ?? "");
    setJsonDraft(formatJson(component.jsonContent ?? "{}"));
    setParseError(false);
    setIsEditingJson(false);
  }, [component.id]);

  useEffect(() => {
    if (!isEditingJson) {
      setJsonDraft(formatJson(component.jsonContent ?? "{}"));
    }
  }, [component.jsonContent, isEditingJson]);

  const debouncedUpdate = useMemo(
    () =>
      debounce((patch: ComponentPatch) => {
        updateComponent(component.id, patch);
      }, FIELD_DEBOUNCE_MS),
    [component.id, updateComponent],
  );

  useEffect(() => () => debouncedUpdate.cancel(), [debouncedUpdate]);

  const handleCommitJson = () => {
    if (!isValidJson(jsonDraft)) {
      setParseError(true);
      return;
    }
    setParseError(false);
    setIsEditingJson(false);
    updateComponent(component.id, { jsonContent: jsonDraft });
  };

  const handleCancelJson = () => {
    setJsonDraft(formatJson(component.jsonContent ?? "{}"));
    setParseError(false);
    setIsEditingJson(false);
  };

  const handleFormatJson = () => {
    if (!isValidJson(jsonDraft)) {
      setParseError(true);
      return;
    }
    setJsonDraft(formatJson(jsonDraft));
    setParseError(false);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <Braces className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex-1 truncate">
          {t("jsonViewer.panelTitle")}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
          aria-label={t("common.close")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <TabBar active={tab} onChange={setTab} showConnections={false} />

      <div className="flex-1 overflow-y-auto min-h-0">
        {tab === "details" && (
          <div className="flex flex-col gap-4 p-4">
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
                {t("common.name")}
              </label>
              <input
                ref={titleInputRef}
                className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  debouncedUpdate({ name: event.target.value });
                }}
              />
            </div>

            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
                {t("jsonViewer.schemaRef")}
              </label>
              <input
                className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder={t("jsonViewer.schemaRefPlaceholder")}
                value={schemaRef}
                onChange={(event) => {
                  const next = event.target.value;
                  setSchemaRef(next);
                  debouncedUpdate({ schemaRef: next.trim() === "" ? undefined : next });
                }}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
                  {t("jsonViewer.jsonContent")}
                </label>
                <div className="flex items-center gap-1">
                  {!isEditingJson ? (
                    <button
                      type="button"
                      onClick={() => setIsEditingJson(true)}
                      className="text-[11px] text-primary hover:underline"
                    >
                      {t("jsonViewer.edit")}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleFormatJson}
                        className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                      >
                        {t("jsonViewer.format")}
                      </button>
                      <span className="text-muted-foreground text-[11px]">·</span>
                      <button
                        type="button"
                        onClick={handleCommitJson}
                        className="text-[11px] text-green-500 hover:underline"
                      >
                        {t("common.save")}
                      </button>
                      <span className="text-muted-foreground text-[11px]">·</span>
                      <button
                        type="button"
                        onClick={handleCancelJson}
                        className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                      >
                        {t("common.cancel")}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {parseError && (
                <p className="text-[11px] text-destructive mb-1">{t("jsonViewer.invalidJson")}</p>
              )}

              <div
                className={cn(
                  "rounded-md overflow-hidden border",
                  isEditingJson ? "border-primary/50" : "border-border",
                )}
                style={{ height: 320 }}
              >
                <Editor
                  height="100%"
                  language="json"
                  theme={editorTheme}
                  value={jsonDraft}
                  onChange={(value: Parameters<NonNullable<EditorProps["onChange"]>>[0]) => {
                    if (isEditingJson) {
                      setJsonDraft(value ?? "");
                      setParseError(false);
                    }
                  }}
                  options={{
                    ...MONACO_OPTIONS,
                    readOnly: !isEditingJson,
                    renderLineHighlight: isEditingJson ? "line" : "none",
                  }}
                  onMount={(editor: Parameters<NonNullable<EditorProps["onMount"]>>[0]) => {
                    editor.getDomNode()?.addEventListener("keydown", (keyboardEvent: Event) => {
                      keyboardEvent.stopPropagation();
                    });
                  }}
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
                {t("elementPanel.idLabel")}
              </label>
              <p className="text-xs font-mono text-muted-foreground bg-secondary rounded px-2 py-1.5">
                {component.id}
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  debouncedUpdate.cancel();
                  removeComponent(component.id);
                  onClose();
                }}
                className="flex items-center justify-center gap-1.5 rounded-md border border-destructive/30 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors w-full"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t("elementPanel.remove")}
              </button>
            </div>
          </div>
        )}

        {tab === "icon" && (
          <ComponentIconTab
            component={component}
            diagramId={activeDiagram?.id ?? ""}
            updateComponent={updateComponent}
          />
        )}
      </div>
    </div>
  );
}
