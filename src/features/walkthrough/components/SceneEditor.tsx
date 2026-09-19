import { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, GripVertical, ChevronDown, ChevronRight, Play, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDiagramStore, useDiagrams } from "@/features/diagram";
import type { WalkthroughPresentation, WalkthroughStepRef } from "../model/walkthrough.types";
import { ViewerCanvas } from "@/features/viewer";

interface Props {
  presentation: WalkthroughPresentation;
  onUpdate: (updated: WalkthroughPresentation) => void;
}

export function SceneEditor({ presentation, onUpdate }: Props) {
  const { t } = useTranslation();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(
    presentation.steps.length > 0 ? 0 : null,
  );
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set([0]));

  const diagramsRecord = useDiagrams();
  const diagramList = Object.values(diagramsRecord);
  const diagramStore = useDiagramStore((s) => s.diagrams);

  // Map from diagramId → flows in that diagram
  const flowsByDiagram = useMemo(() => {
    const map: Record<string, { id: string; name: string }[]> = {};
    for (const diagram of diagramList) {
      const flows = Object.values(diagram.snapshot.flows ?? {});
      if (flows.length > 0) {
        map[diagram.id] = flows.map((f: { id: string; name: string }) => ({ id: f.id, name: f.name }));
      }
    }
    return map;
  }, [diagramList]);

  const selectedStep = selectedIndex !== null ? presentation.steps[selectedIndex] : null;
  const selectedDiagram = selectedStep ? diagramStore[selectedStep.diagramId] : null;

  const toggleExpand = useCallback(
    (index: number) => {
      setExpandedSteps((prev) => {
        const next = new Set(prev);
        if (next.has(index)) next.delete(index);
        else next.add(index);
        return next;
      });
    },
    [],
  );

  const updateStep = useCallback(
    (index: number, patch: Partial<WalkthroughStepRef>) => {
      const steps = presentation.steps.map((s, i) =>
        i === index ? { ...s, ...patch } : s,
      );
      onUpdate({ ...presentation, steps });
    },
    [presentation, onUpdate],
  );

  const addStep = useCallback(() => {
    const newStep: WalkthroughStepRef =
      diagramList.length > 0 && Object.keys(flowsByDiagram).length > 0
        ? { diagramId: diagramList[0].id, flowId: Object.values(flowsByDiagram)[0][0].id }
        : { diagramId: "", flowId: "" };
    const steps = [...presentation.steps, newStep];
    const newIndex = steps.length - 1;
    onUpdate({ ...presentation, steps });
    setSelectedIndex(newIndex);
    setExpandedSteps((prev) => new Set([...prev, newIndex]));
  }, [presentation, onUpdate, diagramList, flowsByDiagram]);

  const removeStep = useCallback(
    (index: number) => {
      const steps = presentation.steps.filter((_, i) => i !== index);
      onUpdate({ ...presentation, steps });
      if (selectedIndex !== null) {
        if (index < selectedIndex) setSelectedIndex(selectedIndex - 1);
        else if (index === selectedIndex) setSelectedIndex(null);
      }
    },
    [presentation, onUpdate, selectedIndex],
  );

  const moveStep = useCallback(
    (fromIndex: number, direction: "up" | "down") => {
      const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
      if (toIndex < 0 || toIndex >= presentation.steps.length) return;
      const steps = [...presentation.steps];
      [steps[fromIndex], steps[toIndex]] = [steps[toIndex], steps[fromIndex]];
      onUpdate({ ...presentation, steps });
      setSelectedIndex(toIndex);
    },
    [presentation, onUpdate],
  );

  return (
    <div className="flex h-full gap-0">
      {/* Left: Scene list */}
      <div className="flex w-64 shrink-0 flex-col border-r border-border">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">
            {t("walkthrough.scenes", "Scenes")} ({presentation.steps.length})
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={addStep}
            title={t("walkthrough.addScene", "Add scene")}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {presentation.steps.length === 0 ? (
            <div className="p-3">
              <p className="text-xs text-muted-foreground">
                {t("walkthrough.noScenes", "No scenes yet. Add one to get started.")}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {presentation.steps.map((step, index) => {
                const diagram = diagramStore[step.diagramId];
                const diagramName = diagram?.name ?? step.diagramId ?? "—";
                const flow = diagram?.snapshot.flows?.[step.flowId];
                const isSelected = index === selectedIndex;
                const isExpanded = expandedSteps.has(index);

                return (
                  <li key={index}>
                    <div
                      className={`flex items-center gap-1 px-2 py-2 text-xs cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted/50 text-foreground"
                      }`}
                      onClick={() => {
                        setSelectedIndex(index);
                        if (!expandedSteps.has(index)) toggleExpand(index);
                      }}
                    >
                      <button
                        type="button"
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(index);
                        }}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                      </button>
                      <span className="truncate flex-1">
                        {step.label ||
                          (flow ? flow.name : t("walkthrough.unnamedScene", "Scene"))}
                      </span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        #{index + 1}
                      </span>
                    </div>
                    {isExpanded && isSelected && (
                      <div className="border-t border-border px-3 py-2">
                        <div className="flex flex-col gap-1 text-[11px] text-muted-foreground mb-2">
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{diagramName}</span>
                          </div>
                          {flow && (
                            <div className="flex items-center gap-1">
                              <Play className="h-3 w-3 shrink-0" />
                              <span className="truncate">{flow.name}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={() => moveStep(index, "up")}
                            disabled={index === 0}
                            title={t("walkthrough.moveUp", "Move up")}
                          >
                            <ChevronDown className="h-3 w-3 rotate-180" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={() => moveStep(index, "down")}
                            disabled={index === presentation.steps.length - 1}
                            title={t("walkthrough.moveDown", "Move down")}
                          >
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6 shrink-0 text-destructive hover:text-destructive ml-auto"
                            onClick={() => removeStep(index)}
                            title={t("walkthrough.removeScene", "Remove scene")}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Right: Form + Preview */}
      <div className="flex flex-1 flex-col min-w-0">
        {selectedStep === null ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            {t("walkthrough.selectSceneToEdit", "Select a scene to edit")}
          </div>
        ) : (
          <div className="flex flex-1 flex-col min-h-0">
            {/* Form */}
            <div className="border-b border-border bg-muted/20 px-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Diagram selector */}
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    {t("walkthrough.diagram", "Diagram")}
                  </Label>
                  <Select
                    value={selectedStep.diagramId}
                    onValueChange={(diagramId) => {
                      // Reset flow when diagram changes
                      const flows = flowsByDiagram[diagramId] ?? [];
                      const newFlowId = flows.length > 0 ? flows[0].id : "";
                      updateStep(selectedIndex!, { diagramId, flowId: newFlowId });
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder={t("walkthrough.selectDiagram", "Select diagram")} />
                    </SelectTrigger>
                    <SelectContent>
                      {diagramList.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Flow selector */}
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    {t("walkthrough.flow", "Flow")}
                  </Label>
                  <Select
                    value={selectedStep.flowId}
                    onValueChange={(flowId) => updateStep(selectedIndex!, { flowId })}
                    disabled={!selectedStep.diagramId || (flowsByDiagram[selectedStep.diagramId] ?? []).length === 0}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue
                        placeholder={t("walkthrough.selectFlow", "Select flow")}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {(flowsByDiagram[selectedStep.diagramId] ?? []).map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(flowsByDiagram[selectedStep.diagramId] ?? []).length === 0 &&
                    selectedStep.diagramId && (
                      <p className="text-[10px] text-muted-foreground">
                        {t("walkthrough.noFlowsInDiagram", "No flows in this diagram")}
                      </p>
                    )}
                </div>

                {/* Label override */}
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    {t("walkthrough.stepLabel", "Step label")}{" "}
                    <span className="font-normal text-muted-foreground">
                      ({t("walkthrough.optional", "optional")})
                    </span>
                  </Label>
                  <Input
                    className="h-8 text-xs"
                    value={selectedStep.label ?? ""}
                    onChange={(e) => updateStep(selectedIndex!, { label: e.target.value })}
                    placeholder={t("walkthrough.stepLabelPlaceholder", "Uses the flow name by default")}
                  />
                </div>

                {/* Author note */}
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    {t("walkthrough.authorNote", "Author note")}{" "}
                    <span className="font-normal text-muted-foreground">
                      ({t("walkthrough.optional", "optional")})
                    </span>
                  </Label>
                  <Input
                    className="h-8 text-xs"
                    value={selectedStep.note ?? ""}
                    onChange={(e) => updateStep(selectedIndex!, { note: e.target.value })}
                    placeholder={t("walkthrough.authorNotePlaceholder", "Not shown to readers")}
                  />
                </div>
              </div>
            </div>

            {/* Live preview */}
            <div className="flex flex-1 flex-col min-h-0">
              <div className="border-b border-border bg-muted/10 px-4 py-1.5">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  {t("walkthrough.preview", "Preview")}
                </span>
              </div>
              <div className="flex-1 min-h-0">
                {selectedDiagram ? (
                  <ViewerCanvas
                    diagram={selectedDiagram}
                    initialFlowId={selectedStep.flowId || null}
                    showOpenInStructuraButton={false}
                  />
                ) : selectedStep.diagramId ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    {t("walkthrough.diagramNotFound", "Diagram not found")}
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    {t("walkthrough.selectDiagramFirst", "Select a diagram to preview")}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
