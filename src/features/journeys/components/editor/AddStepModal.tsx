import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAllDiagrams } from "@/features/diagram";
import type { Diagram } from "@/features/diagram";
import type { JourneyStep } from "../../types";

interface AddStepModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  journeyId: string;
  onConfirm: (step: Omit<JourneyStep, "id" | "order">) => void;
}

function diagramSearchableText(diagram: Diagram): string {
  return `${diagram.name} ${diagram.domain ?? ""}`.toLowerCase();
}

export function AddStepModal({
  open,
  onOpenChange,
  journeyId: _journeyId,
  onConfirm,
}: AddStepModalProps) {
  const { t } = useTranslation();
  void _journeyId;

  const allDiagrams = useAllDiagrams();
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [diagramSearch, setDiagramSearch] = useState("");
  const [selectedDiagramId, setSelectedDiagramId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!open) return;
    setLabel("");
    setDescription("");
    setDiagramSearch("");
    setSelectedDiagramId(null);
  }, [open]);

  const filteredDiagrams = useMemo(() => {
    const query = diagramSearch.trim().toLowerCase();
    const sorted = [...allDiagrams].sort((left, right) =>
      left.name.localeCompare(right.name),
    );
    if (!query) return sorted;
    return sorted.filter((diagram) =>
      diagramSearchableText(diagram).includes(query),
    );
  }, [allDiagrams, diagramSearch]);

  const handleDiagramRowClick = (diagramId: string) => {
    setSelectedDiagramId((previous) =>
      previous === diagramId ? null : diagramId,
    );
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmedLabel = label.trim();
    if (!trimmedLabel) return;

    onConfirm({
      label: trimmedLabel,
      description: description.trim() || undefined,
      diagramId: selectedDiagramId ?? undefined,
    });
    onOpenChange(false);
  };

  const submitDisabled = !label.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-hidden overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("journeys.editor.addStepTitle")}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground">
                {t("journeys.editor.stepLabel")}{" "}
                <span className="text-destructive" aria-hidden>
                  *
                </span>
              </label>
              <Input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder={t("journeys.editor.stepLabelPlaceholder")}
                required
                autoFocus
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground">
                {t("journeys.editor.stepDescription")}
              </label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={2}
                className="w-full resize-none rounded-md border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground">
                {t("journeys.editor.stepDiagramOptional")}
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={diagramSearch}
                  onChange={(event) => setDiagramSearch(event.target.value)}
                  placeholder={t("journeys.editor.diagramSearchPlaceholder")}
                  className="pl-9"
                />
              </div>
              <div className="max-h-40 overflow-y-auto rounded-md border border-border">
                {filteredDiagrams.map((diagram) => (
                  <button
                    key={diagram.id}
                    type="button"
                    onClick={() => handleDiagramRowClick(diagram.id)}
                    className={`flex w-full flex-col items-start gap-0.5 border-b border-border px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted/60 ${
                      selectedDiagramId === diagram.id ? "bg-primary/10" : ""
                    }`}
                  >
                    <span className="font-medium text-foreground">
                      {diagram.name}
                    </span>
                    {diagram.domain ? (
                      <span className="text-xs text-muted-foreground">
                        {diagram.domain}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={submitDisabled}>
              {t("journeys.editor.addStepSubmit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
