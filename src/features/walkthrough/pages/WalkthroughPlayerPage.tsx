import { useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ChevronRight,
  RefreshCcw,
  Clapperboard,
  AlertTriangle,
  StickyNote,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWalkthroughStore } from "../hooks/useWalkthroughStore";
import { useDiagramStore } from "@/features/diagram";
import { WalkthroughSceneCanvas } from "../components/WalkthroughSceneCanvas";
import { WalkthroughDiagramNotFound } from "../components/WalkthroughDiagramNotFound";

/** How long the change-of-diagram notice stays up. */
const DIAGRAM_NOTICE_MS = 3000;

interface SceneEndOverlayProps {
  presentationTitle: string;
  nextSceneLabel: string | null;
  currentStepIndex: number;
  totalSteps: number;
  onNextScene: () => void;
  onPrevScene: () => void;
  onDismiss: () => void;
  onLeave: () => void;
  isFirst: boolean;
  isLast: boolean;
}

/**
 * The stop between two scenes.
 *
 * A scene's flow running out is not the walkthrough running out, and crossing
 * from one diagram to another is a big enough visual change that doing it
 * mid-keypress reads as a glitch. So forward stops here once, says where the
 * reader is and what comes next, and the next forward crosses.
 */
function SceneEndOverlay({
  presentationTitle,
  nextSceneLabel,
  currentStepIndex,
  totalSteps,
  onNextScene,
  onPrevScene,
  onDismiss,
  onLeave,
  isFirst,
  isLast,
}: SceneEndOverlayProps) {
  const { t } = useTranslation();

  // The overlay owns the keys while it is up. The viewer's own handler has
  // already stopped short — it is at the end of the flow — so there is nothing
  // to fight, but forward must now mean "cross", not "advance".
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (isLast) onLeave();
        else onNextScene();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!isFirst) onPrevScene();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onDismiss();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFirst, isLast, onNextScene, onPrevScene, onDismiss, onLeave]);

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      role="dialog"
      aria-label={t("walkthrough.sceneComplete")}
      data-testid="scene-boundary"
    >
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 shadow-lg">
        <div className="text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            {isLast ? t("walkthrough.endOfWalkthrough") : t("walkthrough.sceneComplete")}
          </p>
          <h2 className="mt-1 text-lg font-semibold">{presentationTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("walkthrough.sceneProgress", {
              current: currentStepIndex + 1,
              total: totalSteps,
            })}
          </p>
          {!isLast && nextSceneLabel && (
            <p className="mt-2 text-sm">
              <span className="text-muted-foreground">{t("walkthrough.upNext")} </span>
              <span className="font-medium text-foreground">{nextSceneLabel}</span>
            </p>
          )}
        </div>
        <div className="flex gap-3">
          {!isFirst && (
            <Button variant="outline" size="sm" onClick={onPrevScene} className="gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" />
              {t("walkthrough.previousScene")}
            </Button>
          )}
          {!isLast ? (
            <Button size="sm" onClick={onNextScene} className="gap-1.5">
              {t("walkthrough.nextScene")}
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={onLeave}>
              {t("walkthrough.backToLibrary")}
            </Button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">{t("walkthrough.boundaryHint")}</p>
      </div>
    </div>
  );
}

/**
 * The author's note for the scene in hand.
 *
 * Top right, clear of the reading rail on the left and of the change-of-diagram
 * notice in the middle. Over the canvas rather than in a column of its own,
 * because it is a remark about the scene and should cost the diagram nothing
 * when a scene carries none.
 *
 * Dismissable for the scene being read; crossing into the next one brings its
 * own note back, since closing this is "I have read it", not a preference.
 */
function SceneNote({ note, onDismiss }: { note: string; onDismiss: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      data-testid="scene-note"
      className="absolute right-4 top-4 z-20 max-w-xs rounded-lg border border-border bg-card/95 p-3 shadow-lg backdrop-blur"
    >
      <div className="mb-1 flex items-center gap-1.5">
        <StickyNote className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="flex-1 text-[11px] font-medium text-muted-foreground">
          {t("walkthrough.sceneNote")}
        </span>
        <button
          type="button"
          onClick={onDismiss}
          title={t("walkthrough.hideNote")}
          aria-label={t("walkthrough.hideNote")}
          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="text-[13px] leading-relaxed text-foreground [text-wrap:pretty]">{note}</p>
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
  const [noteDismissed, setNoteDismissed] = useState(false);
  const [showDiagramTransition, setShowDiagramTransition] = useState(false);
  const [transitionTarget, setTransitionTarget] = useState<string | null>(null);
  const prevDiagramIdRef = useRef<string | null>(null);

  const stepIndex = Math.max(0, parseInt(stepParam ?? "0", 10));
  const presentation = id ? presentations[id] : null;
  const step = presentation?.steps[stepIndex] ?? null;

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  // Crossing into a scene that reads from another diagram is announced, because
  // the whole canvas changing under a keypress otherwise reads as a glitch.
  // The timer is cleared on the way out: a reader who leaves before it expires
  // must not leave an update aimed at a departed player behind them.
  useEffect(() => {
    if (!step) return;
    if (step.diagramId === prevDiagramIdRef.current) return;

    const isFirstScene = prevDiagramIdRef.current === null;
    prevDiagramIdRef.current = step.diagramId;
    if (isFirstScene) return;

    setTransitionTarget(step.diagramId);
    setShowDiagramTransition(true);
    const timer = setTimeout(() => setShowDiagramTransition(false), DIAGRAM_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [step]);

  const goToScene = useCallback(
    (index: number) => {
      if (!id) return;
      if (index < 0 || !presentation || index >= presentation.steps.length) return;
      navigate(`/workflow/${id}/step/${index}`);
      setShowEndOverlay(false);
      setNoteDismissed(false);
    },
    [id, presentation, navigate],
  );

  const goNextScene = useCallback(() => {
    if (presentation) goToScene(stepIndex + 1);
  }, [presentation, stepIndex, goToScene]);

  const goPrevScene = useCallback(() => {
    goToScene(stepIndex - 1);
  }, [stepIndex, goToScene]);

  const leaveToLibrary = useCallback(() => {
    // In-application routing: a document load here would throw away the loaded
    // workspace and the connected folder handle with it.
    navigate("/workflows");
  }, [navigate]);

  const handleSkipScene = useCallback(() => {
    goNextScene();
  }, [goNextScene]);

  /** The viewer says the scene's flow has run out; the player decides what that means. */
  const handleReachedFlowEnd = useCallback(() => {
    setShowEndOverlay(true);
  }, []);

  /** Back at the entry step reaches into the scene before this one. */
  const handleReachedFlowStart = useCallback(() => {
    if (stepIndex > 0) goPrevScene();
  }, [stepIndex, goPrevScene]);

  // ⌘ + arrow skips a whole scene without walking its steps — the shortcut for
  // someone who knows where they are going. It is no longer the only way
  // across a boundary, and the footer names it rather than leaving it to be
  // guessed. ⌘ is never Ctrl here, so this cannot clash with browser history
  // (⌘[ / ⌘]) or the editor's Ctrl+arrow hotkeys.
  //
  // Skipped while focus is in a text field and while an extra modifier is held.
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
          <p className="text-sm text-muted-foreground">{t("walkthrough.notFound")}</p>
          <Button variant="link" className="mt-2" onClick={leaveToLibrary}>
            {t("walkthrough.backToLibrary")}
          </Button>
        </div>
      </div>
    );
  }

  if (!step) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">{t("walkthrough.sceneNotFound")}</p>
          <Button variant="link" className="mt-2" onClick={() => navigate(`/workflow/${id}/edit`)}>
            {t("walkthrough.backToEditor")}
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
          skipLabel={t("walkthrough.skipScene")}
        />
      </div>
    );
  }

  const isFirst = stepIndex === 0;
  const isLast = stepIndex >= presentation.steps.length - 1;

  /** What the boundary calls the scene after this one. */
  const nextStep = presentation.steps[stepIndex + 1];
  const nextSceneLabel = nextStep
    ? nextStep.label ||
      diagrams[nextStep.diagramId]?.snapshot.flows?.[nextStep.flowId]?.name ||
      t("walkthrough.unnamedScene")
    : null;

  return (
    <div className="relative flex h-screen flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-background/95 px-4 py-2 backdrop-blur">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={leaveToLibrary}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <Clapperboard className="h-4 w-4 shrink-0 text-primary" />
          <h1 className="truncate text-sm font-medium">
            {step.label || diagram.snapshot.flows?.[step.flowId]?.name || presentation.title}
          </h1>
          <span
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
            title={t("walkthrough.diagram")}
          >
            <span className="uppercase tracking-wider opacity-70">{t("walkthrough.diagram")}</span>
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
          onClick={() => navigate(`/workflow/${id}/edit`)}
        >
          <RefreshCcw className="h-3 w-3" />
          {t("walkthrough.edit")}
        </Button>
      </div>

      {/* Diagram transition notice */}
      {showDiagramTransition && transitionTarget && (
        <div className="absolute left-1/2 top-16 z-30 -translate-x-1/2 animate-in fade-in slide-in-from-top-2 duration-300">
          <div
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 shadow-lg"
            data-testid="diagram-change-notice"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-xs text-muted-foreground">{t("walkthrough.diagramChanged")}</span>
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
        <WalkthroughSceneCanvas
          key={`${step.diagramId}:${step.flowId}:${stepIndex}`}
          diagram={diagram}
          initialFlowId={step.flowId || null}
          showOpenInStructuraButton={false}
          onReachedFlowEnd={handleReachedFlowEnd}
          onReachedFlowStart={handleReachedFlowStart}
          lockedToInitialFlow
        />

        {step.note && !noteDismissed && (
          <SceneNote note={step.note} onDismiss={() => setNoteDismissed(true)} />
        )}

        {/* Scene end overlay */}
        {showEndOverlay && (
          <SceneEndOverlay
            presentationTitle={presentation.title}
            nextSceneLabel={nextSceneLabel}
            currentStepIndex={stepIndex}
            totalSteps={presentation.steps.length}
            onNextScene={goNextScene}
            onPrevScene={goPrevScene}
            onDismiss={() => setShowEndOverlay(false)}
            onLeave={leaveToLibrary}
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
          {t("walkthrough.previous")}
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
              title={t("walkthrough.sceneNumber", { number: i + 1 })}
            />
          ))}
        </div>

        <div className="flex items-center gap-3">
          {/* The shortcut is named here rather than left to be guessed — it used
              to be the only way across a boundary and nothing said so. */}
          <span className="hidden text-[11px] text-muted-foreground sm:inline">
            {t("walkthrough.skipSceneShortcut")}
          </span>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => (isLast ? leaveToLibrary() : goNextScene())}
          >
            {isLast ? t("walkthrough.finish") : t("walkthrough.next")}
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
