import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { LazyMonacoEditor as Editor, type EditorProps } from "@/lib/monaco/LazyMonacoEditor";
import type { JsonViewerComponent, ComponentPatch } from "@/features/diagram";
import { CommitField, ElementScaffold, PanelSection } from "./shell";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";

interface JsonViewerPanelProps {
  component: JsonViewerComponent;
  onClose: () => void;
  updateComponent: (id: string, patch: ComponentPatch) => void;
  removeComponent: (id: string) => void;
  focusTitleTrigger?: number;
  onFocusElement?: (componentId: string) => void;
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
  onFocusElement,
}: JsonViewerPanelProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const editorTheme = theme === "dark" ? "vs-dark" : "light";

  const [jsonDraft, setJsonDraft] = useState(() => formatJson(component.jsonContent ?? "{}"));
  const [parseError, setParseError] = useState(false);
  const [isEditingJson, setIsEditingJson] = useState(false);

  useEffect(() => {
    if (!isEditingJson) {
      setJsonDraft(formatJson(component.jsonContent ?? "{}"));
    }
  }, [component.jsonContent, isEditingJson]);

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
                  <span className="text-[11px] text-muted-foreground">·</span>
                  <button
                    type="button"
                    onClick={handleCommitJson}
                    className="text-[11px] text-green-500 hover:underline"
                  >
                    {t("common.save")}
                  </button>
                  <span className="text-[11px] text-muted-foreground">·</span>
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
            <p className="mb-1 text-[11px] text-destructive">{t("jsonViewer.invalidJson")}</p>
          )}

          <div
            className={cn(
              "overflow-hidden rounded-md border",
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
      </PanelSection>
    </ElementScaffold>
  );
}
