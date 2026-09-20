import { useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronRight, RefreshCcw, Clapperboard, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWalkthroughStore } from "../hooks/useWalkthroughStore";
import { useDiagramStore } from "@/features/diagram";
import { ViewerCanvas } from "@/features/viewer";
import { WalkthroughDiagramNotFound } from "../components/WalkthroughDiagramNotFound";

interface SceneEndOverlayProps {
  presentationTitle: string;
  currentStepIndex: number;
  totalSteps: number;
  onNextScene: () => void;
  onPrevScene: () => void;
  isFirst: boolean;
  isLast: boolean;
}

function SceneEndOverlay({
  presentationTitle,
  currentStepIndex,
  totalSteps,
  onNextScene,
  onPrevScene,
  isFirst,
  isLast,
}: SceneEndOverlayProps) {
  const { t } = useTranslation();

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 shadow-lg">
        <div className="text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            {isLast
              ? t("walkthrough.endOfWalkthrough", "End of walkthrough")
              : t("walkthrough.sceneComplete", "Scene complete")}
          </p>
          <h2 className="mt-1 text-lg font-semibold">{presentationTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("walkthrough.sceneProgress", {
              current: currentStepIndex + 1,
              total: totalSteps,
              defaultValue: `Scene ${currentStepIndex + 1} of ${totalSteps}`,
            })}
          </p>
        </div>
        <div className="flex gap-3">
          {!isFirst && (
            <Button variant="outline" size="sm" onClick={onPrevScene} className="gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" />
              {t("walkthrough.previousScene", "Previous")}
            </Button>
          )}
          {!isLast ? (
            <Button size="sm" onClick={onNextScene} className="gap-1.5">
              {t("walkthrough.nextScene", "Next scene")}
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => (window.location.href = "/walkthroughs")}
            >
              {t("walkthrough.backToLibrary", "Back to library")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function WalkthroughPlayerPage() {
  const { t } = useTranslation();
  const { id, step: stepParam } = useParams<{ id: string; step: string }>();
  const navigate = useNavigate();
  const { presentations, hydrated, hydrate } = useWalkthroughStore();
  const diagrams = useDiagramStore((s) => s.diagrams);

  const [showEndOverlay, setShowEndOverlay] = useState(false);
  const [prevDiagramId, setPrevDiagramId] = useState<string | null>(null);
  const [showDiagramTransition, setShowDiagramTransition] = useState(false);
  const [transitionTarget, setTransitionTarget] = useState<string | null>(null);
  const prevDiagramIdRef = useRef<string | null>(null);

  const stepIndex = Math.max(0, parseInt(stepParam ?? "0", 10));
  const presentation = id ? presentations[id] : null;
  const step = presentation?.steps[stepIndex] ?? null;

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  // Detect diagram transition when step changes
  useEffect(() => {
    if (step && step.diagramId !== prevDiagramIdRef.current) {
      if (prevDiagramIdRef.current !== null && step.diagramId !== prevDiagramIdRef.current) {
        setTransitionTarget(step.diagramId);
        setShowDiagramTransition(true);
        setTimeout(() => setShowDiagramTransition(false), 3000);
      }
      prevDiagramIdRef.current = step?.diagramId ?? null;
    }
  }, [step]);

  const goToScene = useCallback(
    (index: number) => {
      if (!id) return;
      if (index < 0 || !presentation || index >= presentation.steps.length) return;
      navigate(`/walkthrough/${id}/step/${index}`);
      setShowEndOverlay(false);
    },
    [id, presentation, navigate],
  );

  const goNextScene = useCallback(() => {
    if (presentation) goToScene(stepIndex + 1);
  }, [presentation, stepIndex, goToScene]);

  const goPrevScene = useCallback(() => {
    goToScene(stepIndex - 1);
  }, [stepIndex, goToScene]);

  const handleSkipScene = useCallback(() => {
    goNextScene();
  }, [goNextScene]);

  // Keyboard shortcuts:
  //   ↓ / →           advance one step in the current flow (handled inside
  //                   ViewerCanvas — playback state lives there).
  //   ⌘ + → / ↓      next scene
  //   ⌘ + ← / ↑      previous scene
  //
  // ⌘ is Meta on macOS (the user's OS per the env). We don't bind Ctrl to
  // scene navigation, so we never clash with browser history (⌘[ / ⌘]) or
  // the editor's Ctrl+arrow hotkeys.
  //
  // Skipped when focus is in an input / textarea / select / contenteditable,
  // and when an extra modifier (Alt or Shift) is held, so it never fights
  // a text field or a native shortcut.
  useEffect(() => {
    function isEditableTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (target.isContentEditable) return true;
      return false;
    }

    function onKey(e: KeyboardEvent) {
      if (!e.metaKey) return;
      if (e.altKey || e.shiftKey || e.ctrlKey) return;
      if (isEditableTarget(e.target)) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        goNextScene();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        goPrevScene();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNextScene, goPrevScene]);

  // If step is null or the referenced diagram doesn't exist, show error
  if (!presentation) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            {t("walkthrough.notFound", "Walkthrough not found")}
          </p>
          <Button
            variant="link"
            className="mt-2"
            onClick={() => navigate("/walkthroughs")}
          >
            {t("walkthrough.backToLibrary", "Back to Library")}
          </Button>
        </div>
      </div>
    );
  }

  if (!step) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            {t("walkthrough.sceneNotFound", "Scene not found")}
          </p>
          <Button
            variant="link"
            className="mt-2"
            onClick={() => navigate(`/walkthrough/${id}/edit`)}
          >
            {t("walkthrough.backToEditor", "Back to editor")}
          </Button>
        </div>
      </div>
    );
  }

  const diagram = diagrams[step.diagramId];
  if (!diagram) {
    return (
      <div className="flex h-screen items-center justify-center">
        <WalkthroughDiagramNotFound
          diagramId={step.diagramId}
          onSkip={presentation.steps.length > stepIndex + 1 ? handleSkipScene : undefined}
          skipLabel={t("walkthrough.skipScene", "Skip scene")}
        />
      </div>
    );
  }

  const isFirst = stepIndex === 0;
  const isLast = stepIndex >= presentation.steps.length - 1;

  return (
    <div className="relative flex h-screen flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-background/95 px-4 py-2 backdrop-blur">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => navigate("/walkthroughs")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <Clapperboard className="h-4 w-4 shrink-0 text-primary" />
          <h1 className="truncate text-sm font-medium">
            {step.label || diagram.snapshot.flows?.[step.flowId]?.name || presentation.title}
          </h1>
          <span
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
            title={t("walkthrough.diagram", "Diagram")}
          >
            <span className="uppercase tracking-wider opacity-70">
              {t("walkthrough.diagram", "Diagram")}
            </span>
            <span className="text-foreground">{diagram.name}</span>
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {stepIndex + 1} / {presentation.steps.length}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5 text-xs"
          onClick={() => navigate(`/walkthrough/${id}/edit`)}
        >
          <RefreshCcw className="h-3 w-3" />
          {t("walkthrough.edit", "Edit")}
        </Button>
      </div>

      {/* Diagram transition notice */}
      {showDiagramTransition && transitionTarget && (
        <div className="absolute left-1/2 top-16 z-30 -translate-x-1/2 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 shadow-lg">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-xs text-muted-foreground">
              {t("walkthrough.diagramChanged", {
                defaultValue: "Now reading from a different diagram",
              })}
            </span>
            <span className="text-xs font-medium">
              {diagrams[transitionTarget]?.name ?? transitionTarget}
            </span>
          </div>
        </div>
      )}

      {/* ViewerCanvas — keyed by step so navigating between scenes
          remounts it and starts the flow playback fresh (resets the
          entered step in the flow, the focused node, etc.). Without
          this key, ViewerCanvas's "initialFlowId" is consumed exactly
          once via an internal ref, so subsequent steps would never
          auto-open their flow. */}
      <div className="relative flex-1 min-h-0">
        <ViewerCanvas
          key={`${step.diagramId}:${step.flowId}:${stepIndex}`}
          diagram={diagram}
          initialFlowId={step.flowId || null}
          showOpenInStructuraButton={false}
        />

        {/* Scene end overlay */}
        {showEndOverlay && (
          <SceneEndOverlay
            presentationTitle={presentation.title}
            currentStepIndex={stepIndex}
            totalSteps={presentation.steps.length}
            onNextScene={goNextScene}
            onPrevScene={goPrevScene}
            isFirst={isFirst}
            isLast={isLast}
          />
        )}
      </div>

      {/* Footer navigation */}
      <div className="flex shrink-0 items-center justify-between border-t border-border bg-background/95 px-4 py-2 backdrop-blur">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={goPrevScene}
          disabled={isFirst}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("walkthrough.previous", "Previous")}
        </Button>

        {/* Scene indicator dots */}
        <div className="flex items-center gap-1.5">
          {presentation.steps.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                i === stepIndex
                  ? "bg-primary"
                  : i < stepIndex
                    ? "bg-primary/40"
                    : "bg-muted-foreground/30"
              }`}
              onClick={() => goToScene(i)}
              title={`Scene ${i + 1}`}
            />
          ))}
        </div>

        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => (isLast ? navigate("/walkthroughs") : goNextScene())}
        >
          {isLast ? t("walkthrough.finish", "Finish") : t("walkthrough.next", "Next")}
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
