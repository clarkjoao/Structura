import { AlertTriangle, ArrowRight, Box } from "lucide-react";
import type { Flow } from "@/features/diagram";
import type { BrokenStep } from "./validateFlow";
import { useTranslation } from "react-i18next";

interface Props {
  flow: Flow;
  brokenSteps: BrokenStep[];
  /**
   * The scene in view, when one is active.
   *
   * Removing the steps rewrites the flow in the *base* model, which a scene is
   * not allowed to touch: the change would outlive the scene and hit everyone
   * looking at the base. So the removal is refused here, in the open, instead
   * of being carried out behind the gesture that asked to play.
   */
  sceneInView?: { name: string };
  onRemoveSteps: (stepIds: string[]) => void;
  onCancel: () => void;
}

const BrokenFlowDialog = ({ flow, brokenSteps, sceneInView, onRemoveSteps, onCancel }: Props) => {
  const { t } = useTranslation();
  // A step whose element a scene still owns is not removed. It reads as broken
  // only because the scene is not open; deleting it would answer "this element
  // is out of reach from here" by throwing the reference away.
  //
  // When that leaves nothing removable, the primary button has no work left, so
  // it goes quiet and the notice says why. Reading that case as "repair anyway"
  // would delete exactly the steps this rule protects, and reading it as "play
  // anyway" would start a flow whose element is not on screen — neither is the
  // dialog's to decide, so it offers the scene as the way forward instead.
  const removable = brokenSteps.filter((b) => !b.inScene);
  const heldScenes = [...new Set(brokenSteps.flatMap((b) => (b.inScene ? [b.inScene.name] : [])))];
  const sceneList = heldScenes.map((name) => `“${name}”`).join(", ");
  const nothingToRemove = removable.length === 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-[480px] rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">{t("brokenFlow.title")}</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {heldScenes.length > 0
                ? t("brokenFlow.descriptionKept", { name: flow.name })
                : t("brokenFlow.descriptionWithName", { name: flow.name })}
            </p>
          </div>
        </div>

        <div className="px-5 py-3 max-h-[280px] overflow-y-auto space-y-1.5">
          {brokenSteps.map((b) => (
            <div
              key={b.stepId}
              className="flex items-center gap-2 rounded-md border border-border bg-secondary/50 px-3 py-2"
            >
              <span className="flex items-center justify-center w-6 h-6 rounded bg-amber-500/10 text-amber-400 text-[10px] font-bold shrink-0">
                {b.stepId.slice(0, 4)}
              </span>
              {b.reason === "component_deleted" ? (
                <Box className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              ) : (
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              )}
              <span className="text-xs text-foreground flex-1 min-w-0 truncate">{b.label}</span>
              {b.inScene ? (
                <span className="text-[10px] rounded bg-amber-500/10 text-amber-500 px-1.5 py-0.5 shrink-0">
                  {t("brokenFlow.inSceneBadge", { scene: b.inScene.name })}
                </span>
              ) : (
                <span className="text-[10px] rounded bg-destructive/10 text-destructive px-1.5 py-0.5 shrink-0">
                  {b.reason === "component_deleted"
                    ? t("brokenFlow.componentDeleted")
                    : t("brokenFlow.connectionRemoved")}
                </span>
              )}
            </div>
          ))}
        </div>

        {sceneInView && (
          <div
            data-testid="broken-flow-scene-block"
            className="mx-5 mb-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2"
          >
            <p className="text-[11px] font-semibold text-amber-500">
              {t("brokenFlow.sceneBlocked", { scene: sceneInView.name })}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {t("brokenFlow.sceneBlockedFix")}
            </p>
          </div>
        )}

        {heldScenes.length > 0 && (
          <div
            data-testid="broken-flow-kept-block"
            className="mx-5 mb-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2"
          >
            <p className="text-[11px] font-semibold text-amber-500">
              {nothingToRemove
                ? t("brokenFlow.nothingToRemove", { scenes: sceneList })
                : t("brokenFlow.keptInScene", { scenes: sceneList })}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {t("brokenFlow.keptInSceneFix")}
            </p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md transition-colors"
          >
            {t("brokenFlow.cancel")}
          </button>
          <button
            disabled={Boolean(sceneInView) || nothingToRemove}
            title={
              sceneInView
                ? t("brokenFlow.sceneBlocked", { scene: sceneInView.name })
                : nothingToRemove
                  ? t("brokenFlow.nothingToRemove", { scenes: sceneList })
                  : undefined
            }
            onClick={() => onRemoveSteps(removable.map((b) => b.stepId))}
            className="px-3 py-1.5 text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-md transition-colors disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:hover:bg-muted"
          >
            {t("brokenFlow.removeInvalid")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BrokenFlowDialog;
