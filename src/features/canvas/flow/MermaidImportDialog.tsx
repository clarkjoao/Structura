import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { useTranslation } from "react-i18next";
import { parseMermaidSequence } from "@/features/diagram";
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (text: string, flowName: string) => void;
}

interface ValidationState {
  errors: string[];
  newComponents: number;
  newConnections: number;
}

const DEFAULT_FLOW_NAME = "Imported Flow";

export function MermaidImportDialog({ open, onOpenChange, onImport }: Props) {
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
      const result = parseMermaidSequence(text, {}, {}, { x: 0, y: 0 });
      const nextErrors = [...result.errors];
      if (!text.includes("sequenceDiagram")) {
        nextErrors.unshift(t("flows.importDialog.invalidDiagram"));
      }
      setValidation({
        errors: nextErrors,
        newComponents: result.newComponents.length,
        newConnections: result.newConnections.length,
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
    onImport(text, flowName.trim() || DEFAULT_FLOW_NAME);
  };

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
            disabled={!text.trim() || (validation !== null && validation.errors.length > 0)}
          >
            {t("flows.importDialog.import")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default MermaidImportDialog;
