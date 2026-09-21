import { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDiagramStore, useDiagrams } from "@/features/diagram";
import type { WalkthroughPresentation, WalkthroughStepRef } from "../model/walkthrough.types";
import { newStepId } from "../model/ensureStepIds";
import { ViewerCanvas } from "@/features/viewer";
import { cn } from "@/lib/utils";
import { WALKTHROUGH_SCENE_DRAG_MIME } from "@/components/folders/dragTypes";

interface Props {
  presentation: WalkthroughPresentation;
  onUpdate: (updated: WalkthroughPresentation) => void;
}

export function SceneEditor({ presentation, onUpdate }: Props) {
  const { t } = useTranslation();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(
    presentation.steps.length > 0 ? 0 : null,
  );
  /** Where the dragged scene came from, and the gap it would land in. */
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const diagramsRecord = useDiagrams();
  const diagramList = Object.values(diagramsRecord);
  const diagramStore = useDiagramStore((s) => s.diagrams);

  // Map from diagramId → flows in that diagram
  const flowsByDiagram = useMemo(() => {
    const map: Record<string, { id: string; name: string }[]> = {};
    for (const diagram of diagramList) {
      const flows = Object.values(diagram.snapshot.flows ?? {});
      if (flows.length > 0) {
        map[diagram.id] = flows.map((f: { id: string; name: string }) => ({
          id: f.id,
          name: f.name,
        }));
      }
    }
    return map;
  }, [diagramList]);

  const selectedStep = selectedIndex !== null ? presentation.steps[selectedIndex] : null;
  const selectedDiagram = selectedStep ? diagramStore[selectedStep.diagramId] : null;

  const updateStep = useCallback(
    (index: number, patch: Partial<WalkthroughStepRef>) => {
      const steps = presentation.steps.map((s, i) => (i === index ? { ...s, ...patch } : s));
      onUpdate({ ...presentation, steps });
    },
    [presentation, onUpdate],
  );

  const addStep = useCallback(() => {
    const newStep: WalkthroughStepRef =
      diagramList.length > 0 && Object.keys(flowsByDiagram).length > 0
        ? {
            id: newStepId(),
            diagramId: diagramList[0].id,
            flowId: Object.values(flowsByDiagram)[0][0].id,
          }
        : { id: newStepId(), diagramId: "", flowId: "" };
    const steps = [...presentation.steps, newStep];
    onUpdate({ ...presentation, steps });
    setSelectedIndex(steps.length - 1);
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

  /**
   * Moves a scene into the gap at `insertAt`, counted between scenes: 0 is
   * before the first, `steps.length` after the last. Dropping into either gap
   * beside where the scene already sits does nothing, so a short drag reads as
   * cancelled rather than as a one-place shuffle nobody asked for.
   */
  const reorderStep = useCallback(
    (from: number, insertAt: number) => {
      if (insertAt === from || insertAt === from + 1) return;
      const steps = [...presentation.steps];
      const [moved] = steps.splice(from, 1);
      const target = insertAt > from ? insertAt - 1 : insertAt;
      steps.splice(target, 0, moved);
      onUpdate({ ...presentation, steps });
      setSelectedIndex(target);
    },
    [presentation, onUpdate],
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
    <div className="flex h-full w-full gap-0">
      {/* Left: Scene list */}
      <div className="flex w-64 shrink-0 flex-col border-r border-border">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">
            {t("walkthrough.scenes")} ({presentation.steps.length})
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={addStep}
            title={t("walkthrough.addScene")}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {presentation.steps.length === 0 ? (
            <div className="p-3">
              <p className="text-xs text-muted-foreground">{t("walkthrough.noScenes")}</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {presentation.steps.map((step, index) => {
                const diagram = diagramStore[step.diagramId];
                const flow = diagram?.snapshot.flows?.[step.flowId];
                const isSelected = index === selectedIndex;
                const isLast = index === presentation.steps.length - 1;
                const isDragging = dragIndex === index;

                return (
                  <li
                    // Keyed on the scene, not its position: dragging one past
                    // another used to hand a row the next scene's state.
                    key={step.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(WALKTHROUGH_SCENE_DRAG_MIME, String(index));
                      e.dataTransfer.effectAllowed = "move";
                      setDragIndex(index);
                    }}
                    onDragEnd={() => {
                      setDragIndex(null);
                      setDropIndex(null);
                    }}
                    onDragOver={(e) => {
                      if (dragIndex === null) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      // Above the midpoint lands before this scene, below it after.
                      const rect = e.currentTarget.getBoundingClientRect();
                      setDropIndex(e.clientY < rect.top + rect.height / 2 ? index : index + 1);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragIndex !== null && dropIndex !== null) {
                        reorderStep(dragIndex, dropIndex);
                      }
                      setDragIndex(null);
                      setDropIndex(null);
                    }}
                    className={cn("relative", isDragging && "opacity-40")}
                  >
                    {/* Where the scene would land, drawn in the gap itself. */}
                    {dropIndex === index && (
                      <div className="absolute inset-x-0 top-0 z-10 h-0.5 bg-primary" />
                    )}
                    {isLast && dropIndex === index + 1 && (
                      <div className="absolute inset-x-0 bottom-0 z-10 h-0.5 bg-primary" />
                    )}

                    <div
                      className={cn(
                        "group flex cursor-pointer items-start gap-2 px-2 py-2 transition-colors",
                        isSelected ? "bg-primary/10" : "hover:bg-muted/50",
                      )}
                      onClick={() => setSelectedIndex(index)}
                    >
                      {/* The order is the whole point of a walkthrough, so the
                          number holds a column of its own and the scenes read
                          1-2-3 down the rail. The grip takes its place on
                          hover: the same gutter, one job at a time. */}
                      <button
                        type="button"
                        className="mt-px flex h-4 w-4 shrink-0 cursor-grab items-center justify-center rounded text-[11px] tabular-nums text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring active:cursor-grabbing"
                        aria-label={t("walkthrough.reorderScene", { number: index + 1 })}
                        title={`${t("walkthrough.moveUp")} / ${t("walkthrough.moveDown")}`}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          // Reordering stays reachable without a pointer.
                          if (e.key === "ArrowUp") {
                            e.preventDefault();
                            moveStep(index, "up");
                          } else if (e.key === "ArrowDown") {
                            e.preventDefault();
                            moveStep(index, "down");
                          }
                        }}
                      >
                        <span className="group-hover:hidden">{index + 1}</span>
                        <GripVertical className="hidden h-3 w-3 group-hover:block" />
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <span
                            className={cn(
                              "min-w-0 flex-1 truncate text-xs",
                              isSelected ? "font-medium text-primary" : "text-foreground",
                            )}
                          >
                            {step.label || (flow ? flow.name : t("walkthrough.unnamedScene"))}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 group-focus-within:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeStep(index);
                            }}
                            title={t("walkthrough.removeScene")}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        {/* Which diagram this scene reads from — the one thing
                            the title does not already say, since it is the
                            flow's own name unless the author overrode it. */}
                        <p
                          className={cn(
                            "truncate text-[11px]",
                            diagram ? "text-muted-foreground" : "text-destructive",
                          )}
                        >
                          {diagram ? diagram.name : t("walkthrough.diagramNotFound")}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {presentation.steps.length > 0 && (
            <button
              type="button"
              onClick={addStep}
              className="flex w-full items-center gap-2 border-t border-dashed border-border px-2 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              {t("walkthrough.addScene")}
            </button>
          )}
        </div>
      </div>

      {/* Middle: the diagram. Right: the selected scene's settings.
          Below xl the inspector stacks above the diagram instead, so the three
          columns never squeeze each other — one instance, placed by `order`,
          rather than two copies of the same fields. */}
      <div className="flex min-w-0 flex-1 flex-col xl:flex-row">
        {selectedStep === null || selectedIndex === null ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            {t("walkthrough.selectSceneToEdit")}
          </div>
        ) : (
          <>
            <main className="order-2 flex min-h-0 min-w-0 flex-1 flex-col xl:order-1">
              {selectedDiagram ? (
                <ViewerCanvas
                  key={`${selectedStep.diagramId}:${selectedStep.flowId}`}
                  diagram={selectedDiagram}
                  initialFlowId={null}
                  previewMode
                  previewFlowId={selectedStep.flowId || null}
                  showOpenInStructuraButton={false}
                />
              ) : (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
                  {selectedStep.diagramId
                    ? t("walkthrough.diagramNotFound")
                    : t("walkthrough.selectDiagramFirst")}
                </div>
              )}
            </main>

            <aside className="order-1 shrink-0 overflow-y-auto border-b border-border bg-muted/20 xl:order-2 xl:w-80 xl:border-b-0 xl:border-l">
              <div className="border-b border-border px-4 py-2.5">
                <span className="text-xs font-medium text-muted-foreground">
                  {t("walkthrough.sceneInspector", {
                    current: selectedIndex + 1,
                    total: presentation.steps.length,
                  })}
                </span>
              </div>

              {/* Two-up while the inspector lies across the top, one column once
                  it stands on the right. */}
              <div className="grid grid-cols-2 gap-4 px-4 py-3 xl:grid-cols-1">
                {/* What the scene points at — change either and the scene reads
                    somewhere else, which is why they lead. */}
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("walkthrough.diagram")}</Label>
                  <Select
                    value={selectedStep.diagramId}
                    onValueChange={(diagramId) => {
                      // Reset flow when diagram changes
                      const flows = flowsByDiagram[diagramId] ?? [];
                      updateStep(selectedIndex, {
                        diagramId,
                        flowId: flows.length > 0 ? flows[0].id : "",
                      });
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder={t("walkthrough.selectDiagram")} />
                    </SelectTrigger>
                    <SelectContent>
                      {diagramList.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedStep.diagramId && !selectedDiagram && (
                    <p className="text-[11px] text-destructive">
                      {t("walkthrough.diagramNotFound")}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">{t("walkthrough.flow")}</Label>
                  <Select
                    value={selectedStep.flowId}
                    onValueChange={(flowId) => updateStep(selectedIndex, { flowId })}
                    disabled={
                      !selectedStep.diagramId ||
                      (flowsByDiagram[selectedStep.diagramId] ?? []).length === 0
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder={t("walkthrough.selectFlow")} />
                    </SelectTrigger>
                    <SelectContent>
                      {(flowsByDiagram[selectedStep.diagramId] ?? []).map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* A scene whose diagram has no flows cannot play at all, so
                      it is stated as plainly here as the rail states it. */}
                  {selectedDiagram &&
                    (flowsByDiagram[selectedStep.diagramId] ?? []).length === 0 && (
                      <p className="text-[11px] text-destructive">
                        {t("walkthrough.noFlowsWarning")}
                      </p>
                    )}
                </div>

                {/* Annotations. Optional, and weighted as such. */}
                <div className="space-y-1.5 xl:border-t xl:border-border xl:pt-3">
                  <Label className="text-xs font-normal text-muted-foreground">
                    {t("walkthrough.stepLabel")} ({t("walkthrough.optional")})
                  </Label>
                  <Input
                    className="h-8 text-xs"
                    value={selectedStep.label ?? ""}
                    onChange={(e) => updateStep(selectedIndex, { label: e.target.value })}
                    placeholder={t("walkthrough.stepLabelPlaceholder")}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-normal text-muted-foreground">
                    {t("walkthrough.authorNote")} ({t("walkthrough.optional")})
                  </Label>
                  <Input
                    className="h-8 text-xs"
                    value={selectedStep.note ?? ""}
                    onChange={(e) => updateStep(selectedIndex, { note: e.target.value })}
                    placeholder={t("walkthrough.authorNotePlaceholder")}
                  />
                </div>
              </div>
            </aside>
          </>
        )}
      </div>
    </div>
  );
}
