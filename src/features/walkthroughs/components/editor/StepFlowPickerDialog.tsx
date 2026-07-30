import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useDiagrams } from "@/features/diagram/store";

interface StepFlowPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diagramId: string | null;
  onSelectFlow: (flowId: string) => void;
}

export function StepFlowPickerDialog({
  open,
  onOpenChange,
  diagramId,
  onSelectFlow,
}: StepFlowPickerDialogProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const diagramsRecord = useDiagrams();
  const diagram = diagramId ? diagramsRecord[diagramId] : undefined;

  const flows = useMemo(() => {
    if (!diagram) return [];
    return Object.values(diagram.snapshot.flows).filter(
      (flow) => flow.diagramId === diagram.id && Object.keys(flow.steps).length > 0,
    );
  }, [diagram]);

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    const sorted = [...flows].sort((left, right) => left.name.localeCompare(right.name));
    if (!trimmed) return sorted;
    return sorted.filter((flow) => flow.name.toLowerCase().includes(trimmed));
  }, [flows, query]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("walkthroughs.editor.flowPickerTitle")}</DialogTitle>
        </DialogHeader>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("walkthroughs.editor.flowSearchPlaceholder")}
        />
        <div className="max-h-60 overflow-y-auto rounded-md border border-border">
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              {t("walkthroughs.editor.noFlowsAvailable")}
            </p>
          ) : (
            filtered.map((flow) => (
              <button
                key={flow.id}
                type="button"
                className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted/60"
                onClick={() => {
                  onSelectFlow(flow.id);
                  onOpenChange(false);
                }}
              >
                <span className="font-medium text-foreground">{flow.name}</span>
              </button>
            ))
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
