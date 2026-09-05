import { useTranslation } from "react-i18next";
import type { FlowStep } from "@/features/diagram";
import type { StepCall } from "./stepCall";
import type { StepTarget } from "./readingScene";
import type { ReadingBranch } from "./readingSpine";

interface Props {
  step: FlowStep;
  /** The step's headline call, when it makes one. */
  call: StepCall | null;
  /** Where the step lands on the canvas. */
  target: StepTarget | null;
  /** The one line that names the step — the author's, or the best fallback. */
  heading: string;
  isCondition: boolean;
  branches: readonly ReadingBranch[];
  onChooseBranch: (branchIndex: number) => void;
}

/**
 * The step being read, at full size.
 *
 * The call is the headline: a step that names a connection is a call, and the
 * label the author gave the edge is what a reader recognises it by long before
 * the node it lands on. Everything under it answers "where", "what" and "how
 * long", in that order, and a condition swaps the tail for the ways out.
 */
const FlowReadingScene = ({
  step,
  call,
  target,
  heading,
  isCondition,
  branches,
  onChooseBranch,
}: Props) => {
  const { t } = useTranslation();

  const question = step.conditionLabel?.trim();
  // The step's prose is the content of the scene, whichever field the author
  // put it in: scripts written before `note` existed carry it as `description`,
  // and there is no reading in which that one should be the small print.
  const note = step.note?.trim();
  const description = step.description?.trim();
  const body = note || description;
  const aside = note ? description : undefined;
  const duration = step.duration?.trim();

  return (
    <div
      data-testid="flow-reading-scene"
      className={`min-w-0 flex-1 rounded-lg border border-l-[3px] px-4 pb-4 pt-3.5 ${
        isCondition
          ? "border-amber-500/50 border-l-amber-500 bg-amber-500/[0.07]"
          : "border-primary/45 border-l-primary bg-primary/5"
      }`}
    >
      {call && (
        <div className="mb-2.5 flex flex-wrap items-center gap-2">
          <span
            data-testid="flow-reading-call"
            className={`rounded-md px-2.5 py-1 font-mono text-[13px] font-semibold ${
              isCondition
                ? "border border-border bg-card text-foreground"
                : "bg-primary text-primary-foreground shadow-md"
            }`}
          >
            {call.label}
          </span>
          {call.direction && (
            <span
              data-testid="flow-reading-direction"
              className="rounded bg-secondary px-1.5 py-[3px] text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
            >
              {t(call.direction === "response" ? "flowReading.response" : "flowReading.request")}
            </span>
          )}
        </div>
      )}

      {target && (
        <p data-testid="flow-reading-target" className="mb-2 text-xs text-muted-foreground">
          <span
            className="mr-1.5 inline-block h-[7px] w-[7px] rounded-[2px] align-middle"
            style={{ background: target.color }}
          />
          {t("flowReading.at")}{" "}
          <strong className="font-semibold text-foreground">{target.name}</strong>
          {target.detail ? ` · ${target.detail}` : null}
        </p>
      )}

      <h2
        data-testid="flow-step-title"
        className="mb-2 text-[18px] font-semibold leading-[1.3] text-foreground [font-weight:650] [text-wrap:pretty]"
      >
        {isCondition && <span className="text-amber-600">◇ </span>}
        {heading}
      </h2>

      {isCondition && question && question !== heading && (
        <p className="mb-2 text-[14.5px] leading-[1.55] text-foreground [text-wrap:pretty]">
          {question}
        </p>
      )}

      {body && (
        <p
          data-testid="flow-reading-note"
          className={`text-foreground [text-wrap:pretty] ${
            isCondition ? "text-[14.5px] leading-[1.55]" : "text-[15px] leading-[1.58]"
          }`}
        >
          {body}
        </p>
      )}

      {aside && (
        <p
          data-testid="flow-reading-aside"
          className="mt-1.5 text-[13px] italic leading-[1.5] text-muted-foreground [text-wrap:pretty]"
        >
          {aside}
        </p>
      )}

      {duration && (
        <div className="mt-3 flex items-center gap-2">
          <span
            data-testid="flow-reading-duration"
            className="rounded-[5px] border border-primary/35 bg-card px-[7px] py-[3px] font-mono text-[11px] font-semibold text-primary"
          >
            {duration}
          </span>
        </div>
      )}

      {isCondition && branches.length > 0 && (
        <div className="mt-3.5 flex flex-col gap-2">
          {branches.map((branch) => {
            const steps = t("flowReading.steps", { count: branch.stepCount });
            return (
              <button
                key={branch.index}
                type="button"
                onClick={() => onChooseBranch(branch.index)}
                className="flex w-full items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-left transition-colors hover:bg-surface-hover"
                style={{ borderColor: branch.color }}
              >
                <span
                  className="w-[3px] self-stretch rounded-[2px]"
                  style={{ background: branch.color }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-semibold text-foreground">
                    {branch.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {branch.lead
                      ? t("flowReading.branchDetail", { steps, lead: branch.lead })
                      : steps}
                  </span>
                </span>
                <span className="text-sm" style={{ color: branch.color }}>
                  →
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FlowReadingScene;
