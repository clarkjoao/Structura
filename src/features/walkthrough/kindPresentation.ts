import type { DiagramModel } from "@/features/diagram/model/diagram.types";
import { createBlankPresentation, useWalkthroughStore } from "./store/walkthrough.store";
import type { WalkthroughPresentation } from "./model/walkthrough.types";

/**
 * The walkthrough presenting a diagram scene by scene (spec guided-journey-sharing):
 * the one made for it before, updated, or a new one; saved, and returned to open.
 */
export async function upsertKindPresentation(
  diagram: Pick<DiagramModel, "id" | "name">,
  scenes: ReadonlyArray<{ label: string; flowId: string }>,
): Promise<WalkthroughPresentation> {
  const store = useWalkthroughStore.getState();
  if (!store.hydrated) await store.hydrate();
  const existing = Object.values(useWalkthroughStore.getState().presentations).find(
    (p) => p.source?.diagramId === diagram.id && p.source.kind === "phases",
  );
  const base = existing ?? createBlankPresentation(diagram.name);
  const previous = new Map(base.steps.map((step) => [step.flowId, step]));
  const presentation: WalkthroughPresentation = {
    ...base,
    title: existing?.title ?? diagram.name,
    source: { diagramId: diagram.id, kind: "phases" },
    // A scene keeps its id and note when its flow is still presented.
    steps: scenes.map((scene, index) => ({
      ...(previous.get(scene.flowId) ?? {}),
      id: previous.get(scene.flowId)?.id ?? `scene_${Date.now()}_${index}`,
      diagramId: diagram.id,
      flowId: scene.flowId,
      label: scene.label,
    })),
    updatedAt: Date.now(),
  };
  await store.save(presentation);
  return presentation;
}
