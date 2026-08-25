import { useEffect, useRef, useState } from "react";
import { LazyMonacoEditor as Editor, type EditorProps } from "@/lib/monaco/LazyMonacoEditor";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  CheckCircle2,
  FileInput,
  GitBranch,
  Sparkles,
  Workflow,
} from "lucide-react";
import { parseMermaidFlowchart, parseMermaidSequence } from "@/features/diagram";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type MermaidDiagramType = "sequence" | "flowchart" | "unknown";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (text: string, flowName: string) => void;
  onImportFlowchart?: (text: string, flowName: string) => void;
}

interface ValidationState {
  errors: string[];
  newComponents: number;
  newConnections: number;
  diagramType: MermaidDiagramType;
}

const DEFAULT_FLOW_NAME = "Imported Flow";

const SEQUENCE_EXAMPLE = `sequenceDiagram
    participant User
    participant API
    participant Database

    User->>API: login(username, password)
    API->>Database: findUser(username)
    Database-->>API: user record
    API-->>User: session token
`;

const FLOWCHART_EXAMPLE = `flowchart LR
    Start([Start]) --> Decision{User logged in?}
    Decision -- Yes --> Home[Home page]
    Decision -- No --> Login[Login page]
    Login --> End([End])
    Home --> End
`;

function detectMermaidType(text: string): MermaidDiagramType {
  const firstLine = text.trim().split("\n")[0]?.trim().toLowerCase() ?? "";
  if (firstLine.startsWith("sequencediagram")) return "sequence";
  if (firstLine.startsWith("flowchart")) return "flowchart";
  return "unknown";
}

export function MermaidImportDialog({ open, onOpenChange, onImport, onImportFlowchart }: Props) {
  const { t } = useTranslation();
  const [flowName, setFlowName] = useState(DEFAULT_FLOW_NAME);
  const [text, setText] = useState("");
  const [validation, setValidation] = useState<ValidationState | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<Parameters<NonNullable<EditorProps["onMount"]>>[0] | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) {
      setValidation(null);
      return;
    }
    debounceRef.current = setTimeout(() => {
      const diagramType = detectMermaidType(text);

      if (diagramType === "unknown") {
        setValidation({
          errors: [t("flows.importDialog.unknownDiagramType")],
          newComponents: 0,
          newConnections: 0,
          diagramType,
        });
        return;
      }

      if (diagramType === "sequence") {
        const result = parseMermaidSequence(text, {}, {}, { x: 0, y: 0 });
        setValidation({
          errors: result.errors,
          newComponents: result.newComponents.length,
          newConnections: result.newConnections.length,
          diagramType,
        });
        return;
      }

      const result = parseMermaidFlowchart(text, {}, {}, { x: 0, y: 0 });
      setValidation({
        errors: result.errors,
        newComponents: result.newComponents.length,
        newConnections: result.newConnections.length,
        diagramType,
      });
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [text, t]);

  useEffect(() => {
    if (!open) {
      setText("");
      setValidation(null);
      setFlowName(DEFAULT_FLOW_NAME);
      editorRef.current = null;
    }
  }, [open]);

  const handleImport = () => {
    if (!text.trim()) return;
    const name = flowName.trim() || DEFAULT_FLOW_NAME;
    if (validation?.diagramType === "flowchart" && onImportFlowchart) {
      onImportFlowchart(text, name);
      return;
    }
    onImport(text, name);
  };

  const handleEditorMount: EditorProps["onMount"] = (editor) => {
    editorRef.current = editor;
    editor.focus();
  };

  const handlePasteExample = (kind: "sequence" | "flowchart") => {
    setText(kind === "sequence" ? SEQUENCE_EXAMPLE : FLOWCHART_EXAMPLE);
    setFlowName(kind === "sequence" ? "Login flow" : "Imported process");
  };

  const canImportFlowchart = validation?.diagramType === "flowchart" && Boolean(onImportFlowchart);
  const isValid =
    !!text.trim() &&
    validation !== null &&
    validation.errors.length === 0 &&
    validation.diagramType !== "unknown" &&
    (validation.diagramType !== "flowchart" || canImportFlowchart);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <FileInput className="h-5 w-5 text-primary" />
            <DialogTitle>{t("flows.importDialog.title")}</DialogTitle>
          </div>
          <DialogDescription>{t("flows.importDialog.description")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Label htmlFor="flow-import-name">{t("flows.importDialog.flowName")}</Label>
          <Input
            id="flow-import-name"
            value={flowName}
            onChange={(event) => setFlowName(event.target.value)}
            placeholder={t("flows.importDialog.flowNamePlaceholder")}
            required
          />
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label>{t("flows.importDialog.code")}</Label>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-[10px] text-muted-foreground"
                onClick={() => handlePasteExample("sequence")}
              >
                <Sparkles className="h-3 w-3" />
                {t("flows.importDialog.exampleSequence")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-[10px] text-muted-foreground"
                onClick={() => handlePasteExample("flowchart")}
              >
                <Sparkles className="h-3 w-3" />
                {t("flows.importDialog.exampleFlowchart")}
              </Button>
            </div>
          </div>
          <div className="overflow-hidden rounded-md border border-border">
            <Editor
              language="mermaid"
              theme="vs-dark"
              height="320px"
              value={text}
              onChange={(value: Parameters<NonNullable<EditorProps["onChange"]>>[0]) => setText(value ?? "")}
              onMount={handleEditorMount}
              options={{
                minimap: { enabled: false },
                fontSize: 12,
                wordWrap: "on",
                scrollBeyondLastLine: false,
                lineNumbers: "on",
                renderLineHighlight: "all",
                padding: { top: 12, bottom: 12 },
              }}
            />
          </div>
        </div>

        {validation && (
          <div className="space-y-2">
            {validation.diagramType !== "unknown" && validation.errors.length === 0 && (
              <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-emerald-700 dark:text-emerald-300">
                  {validation.diagramType === "sequence" ? (
                    <span className="inline-flex items-center gap-1 font-medium">
                      <Workflow className="h-3.5 w-3.5" />
                      {t("flows.importDialog.detectedSequence")}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-medium">
                      <GitBranch className="h-3.5 w-3.5" />
                      {t("flows.importDialog.detectedFlowchart")}
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    {t("flows.importDialog.newComponents", { count: validation.newComponents })}
                  </span>
                  <span className="text-muted-foreground">
                    {t("flows.importDialog.newConnections", { count: validation.newConnections })}
                  </span>
                </div>
              </div>
            )}

            {validation.errors.length > 0 && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <p className="font-medium text-destructive text-sm">
                      {t("flows.importDialog.errors")}
                    </p>
                    <ul className="list-disc pl-4 text-xs text-destructive/90 space-y-0.5">
                      {validation.errors.map((error, index) => (
                        <li key={`${error}-${index}`}>{error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleImport} disabled={!isValid}>
            {t("flows.importDialog.import")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default MermaidImportDialog;