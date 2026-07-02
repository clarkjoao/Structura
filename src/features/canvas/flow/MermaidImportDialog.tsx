import { useEffect, useRef, useState } from "react";
import { LazyMonacoEditor as Editor } from "@/lib/monaco/LazyMonacoEditor";
import { useTranslation } from "react-i18next";
import { parseMermaidFlowchart, parseMermaidSequence } from "@/features/diagram";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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

  const canImportFlowchart = validation?.diagramType === "flowchart" && Boolean(onImportFlowchart);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("flows.importDialog.title")}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-2">
          <Label htmlFor="flow-import-name">{t("flows.importDialog.flowName")}</Label>
          <Input
            id="flow-import-name"
            value={flowName}
            onChange={(event) => setFlowName(event.target.value)}
            required
          />
        </div>

        <Editor
          language="mermaid"
          theme="vs-dark"
          height="300px"
          value={text}
          onChange={(value) => setText(value ?? "")}
          options={{
            minimap: { enabled: false },
            fontSize: 12,
            wordWrap: "on",
            scrollBeyondLastLine: false,
          }}
        />

        {validation?.diagramType === "sequence" && (
          <Badge variant="secondary" className="w-fit text-xs">
            {t("flows.importDialog.detectedSequence")}
          </Badge>
        )}
        {validation?.diagramType === "flowchart" && (
          <Badge variant="secondary" className="w-fit text-xs">
            {t("flows.importDialog.detectedFlowchart")}
          </Badge>
        )}

        {validation && (
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              {t("flows.importDialog.newComponents", { count: validation.newComponents })}
            </p>
            <p className="text-muted-foreground">
              {t("flows.importDialog.newConnections", { count: validation.newConnections })}
            </p>
            {validation.errors.length > 0 && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2">
                <p className="font-medium text-destructive">{t("flows.importDialog.errors")}</p>
                <ul className="mt-1 list-disc pl-5 text-destructive">
                  {validation.errors.map((error, index) => (
                    <li key={`${error}-${index}`}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleImport}
            disabled={
              !text.trim() ||
              validation === null ||
              validation.errors.length > 0 ||
              (validation.diagramType === "flowchart" && !canImportFlowchart)
            }
          >
            {t("flows.importDialog.import")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default MermaidImportDialog;
