import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, ChevronRight, Search } from "lucide-react";
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
import { cn } from "@/lib/utils";
import type { WalkthroughStep } from "../../types";

const NONE_DOMAIN_KEY = "__none__";

interface AddStepModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walkthroughId: string;
  onConfirm: (step: Omit<WalkthroughStep, "id" | "order">) => void;
}

function diagramSearchableText(diagram: Diagram): string {
  return `${diagram.name} ${diagram.domain ?? ""}`.toLowerCase();
}

function countDiagramFlows(diagram: Diagram): number {
  return Object.keys(diagram.snapshot.flows).length;
}

function diagramLevelLabelKey(level: string): string {
  switch (level) {
    case "context":
      return "walkthroughs.editor.diagramLevel.context";
    case "container":
      return "walkthroughs.editor.diagramLevel.container";
    case "component":
      return "walkthroughs.editor.diagramLevel.component";
    case "deployment":
      return "walkthroughs.editor.diagramLevel.deployment";
    default:
      return "walkthroughs.editor.diagramLevel.unknown";
  }
}

interface DiagramPickerRowProps {
  diagram: Diagram;
  selected: boolean;
  subtitle: string;
  onSelect: () => void;
}

function DiagramPickerRow({ diagram, selected, subtitle, onSelect }: DiagramPickerRowProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full flex-col gap-1 rounded-md border px-3 py-2 text-left transition-colors hover:bg-muted/60",
        selected ? "border-primary/30 bg-primary/10" : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{diagram.name}</span>
        {selected ? <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden /> : null}
      </div>
      <span className="truncate text-[11px] text-muted-foreground">{subtitle}</span>
    </button>
  );
}

export function AddStepModal({
  open,
  onOpenChange,
  walkthroughId: _walkthroughId,
  onConfirm,
}: AddStepModalProps) {
  const { t } = useTranslation();
  void _walkthroughId;

  const allDiagrams = useAllDiagrams();
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [diagramSearch, setDiagramSearch] = useState("");
  const [selectedDiagramId, setSelectedDiagramId] = useState<string | null>(null);
  const [collapsedDomainKeys, setCollapsedDomainKeys] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!open) return;
    setLabel("");
    setDescription("");
    setDiagramSearch("");
    setSelectedDiagramId(null);
    setCollapsedDomainKeys(new Set());
  }, [open]);

  const diagramSearchActive = diagramSearch.trim().length > 0;

  const filteredDiagrams = useMemo(() => {
    const query = diagramSearch.trim().toLowerCase();
    const sorted = [...allDiagrams].sort((left, right) => left.name.localeCompare(right.name));
    if (!query) return sorted;
    return sorted.filter((diagram) => diagramSearchableText(diagram).includes(query));
  }, [allDiagrams, diagramSearch]);

  const groupedByDomain = useMemo(() => {
    if (diagramSearchActive) return null;
    const map = new Map<string, Diagram[]>();
    for (const diagram of allDiagrams) {
      const key = diagram.domain?.trim() || NONE_DOMAIN_KEY;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(diagram);
    }
    for (const list of map.values()) {
      list.sort((left, right) => left.name.localeCompare(right.name));
    }
    return map;
  }, [allDiagrams, diagramSearchActive]);

  const sortedDomainKeys = useMemo(() => {
    if (!groupedByDomain) return [];
    return Array.from(groupedByDomain.keys()).sort((left, right) => {
      if (left === NONE_DOMAIN_KEY) return 1;
      if (right === NONE_DOMAIN_KEY) return -1;
      return left.localeCompare(right, undefined, { sensitivity: "base" });
    });
  }, [groupedByDomain]);

  const handleDiagramRowClick = (diagramId: string) => {
    setSelectedDiagramId((previous) => (previous === diagramId ? null : diagramId));
  };

  const handleToggleDomain = (domainKey: string) => {
    setCollapsedDomainKeys((previous) => {
      const next = new Set(previous);
      if (next.has(domainKey)) {
        next.delete(domainKey);
      } else {
        next.add(domainKey);
      }
      return next;
    });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmedLabel = label.trim();
    if (!trimmedLabel) return;

    onConfirm({
      label: trimmedLabel,
      description: description.trim() || undefined,
      diagramId: selectedDiagramId ?? "",
    });
    onOpenChange(false);
  };

  const submitDisabled = !label.trim();

  const domainSectionLabel = (domainKey: string): string =>
    domainKey === NONE_DOMAIN_KEY ? t("walkthroughs.noDomain") : domainKey;

  const groupedDiagramSubtitle = (diagram: Diagram): string => {
    const flowCount = countDiagramFlows(diagram);
    const flowsPart = t("walkthroughs.editor.diagramFlowCount", {
      count: flowCount,
    });
    const levelKey = diagramLevelLabelKey(diagram.level);
    const levelPart =
      levelKey === "walkthroughs.editor.diagramLevel.unknown"
        ? t(levelKey, { level: diagram.level })
        : t(levelKey);
    return `${flowsPart} · ${levelPart}`;
  };

  const searchResultSubtitle = (diagram: Diagram): string => {
    const trimmed = diagram.domain?.trim();
    return trimmed ? trimmed : t("walkthroughs.noDomain");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-hidden overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("walkthroughs.editor.addStepTitle")}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground">
                {t("walkthroughs.editor.stepLabel")}{" "}
                <span className="text-destructive" aria-hidden>
                  *
                </span>
              </label>
              <Input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder={t("walkthroughs.editor.stepLabelPlaceholder")}
                required
                autoFocus
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground">
                {t("walkthroughs.editor.stepDescription")}
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
                {t("walkthroughs.editor.stepDiagramOptional")}
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={diagramSearch}
                  onChange={(event) => setDiagramSearch(event.target.value)}
                  placeholder={t("walkthroughs.editor.diagramSearchPlaceholder")}
                  className="pl-9"
                />
              </div>
              <div className="max-h-64 overflow-y-auto rounded-md border border-border">
                {diagramSearchActive ? (
                  <div className="flex flex-col gap-2 p-2">
                    {filteredDiagrams.map((diagram) => (
                      <DiagramPickerRow
                        key={diagram.id}
                        diagram={diagram}
                        selected={selectedDiagramId === diagram.id}
                        subtitle={searchResultSubtitle(diagram)}
                        onSelect={() => handleDiagramRowClick(diagram.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 p-2">
                    {sortedDomainKeys.map((domainKey) => {
                      const diagramsInDomain = groupedByDomain?.get(domainKey) ?? [];
                      const expanded = !collapsedDomainKeys.has(domainKey);
                      return (
                        <div key={domainKey} className="flex flex-col gap-2">
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 py-0.5 text-left"
                            aria-expanded={expanded}
                            onClick={() => handleToggleDomain(domainKey)}
                          >
                            <span className="h-px min-w-[8px] flex-1 bg-border" />
                            <span className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                              {domainSectionLabel(domainKey)} ({diagramsInDomain.length})
                            </span>
                            <span className="h-px min-w-[8px] flex-1 bg-border" />
                            {expanded ? (
                              <ChevronDown
                                className="h-4 w-4 shrink-0 text-muted-foreground"
                                aria-hidden
                              />
                            ) : (
                              <ChevronRight
                                className="h-4 w-4 shrink-0 text-muted-foreground"
                                aria-hidden
                              />
                            )}
                          </button>
                          {expanded ? (
                            <div className="flex flex-col gap-2 pl-0.5">
                              {diagramsInDomain.map((diagram) => (
                                <DiagramPickerRow
                                  key={diagram.id}
                                  diagram={diagram}
                                  selected={selectedDiagramId === diagram.id}
                                  subtitle={groupedDiagramSubtitle(diagram)}
                                  onSelect={() => handleDiagramRowClick(diagram.id)}
                                />
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={submitDisabled}>
              {t("walkthroughs.editor.addStepSubmit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
