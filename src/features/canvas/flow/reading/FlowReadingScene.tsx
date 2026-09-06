import { useTranslation } from "react-i18next";
import { isParallelStep } from "@/features/diagram";
import type { FlowStep } from "@/features/diagram";
import { CONDITION_KIND_NOTE, conditionGlyph, conditionGlyphClass } from "../conditionKinds";
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
  /** The callers still waiting on this step, outermost first. */
  stackTrail?: readonly { frameId: string; name: string }[];
  /** Leaves the call the reader is inside — what a trail segment does. */
  onLeaveFrame?: () => void;
  /**
   * The values this step consumes, for a condition to show what it is testing.
   *
   * A condition is a question, and a question with the answer's input beside it
   * is a different thing to read than a question on its own.
   */
  readValues?: readonly { key: string; value: string; fromNumber: string }[];
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
  stackTrail = [],
  onLeaveFrame,
  readValues = [],
}: Props) => {
  const { t } = useTranslation();

  /**
   * Whether the ways out are threads rather than a choice.
   *
   * A `par` has no question — nothing is decided at it, everything below it
   * happens — so the scene that reads as a fork in the road is describing a
   * different flow. Every difference below comes from this one fact.
   */
  const isParallel = isParallelStep(step);
  /**
   * The one line the kind is owed, when it changes what happened.
   *
   * A `par` runs every way out, a `loop` runs one of them again, an `opt` may
   * run none — all three describe a flow the ways out alone do not. A plain
   * choice is owed nothing, and gets nothing.
   */
  const kindNote = isCondition ? CONDITION_KIND_NOTE[step.conditionKind ?? "alt"] : undefined;
  const question = step.conditionLabel?.trim();
  // The step's prose is the content of the scene, whichever field the author
  // put it in: scripts written before `note` existed carry it as `description`,
  // and there is no reading in which that one should be the small print.
  const note = step.note?.trim();
  const description = step.description?.trim();
  const body = note || description;
  const aside = note ? description : undefined;
  const duration = step.duration?.trim();

  /**
   * The way out those values point at, when a branch label says so.
   *
   * Nothing is evaluated — the label is matched against the value as text. A
   * condition whose branches are not named after their answers simply marks
   * none, which is the honest outcome rather than a guess.
   */
  const takenBranch =
    readValues.length && !isParallel
      ? branches.findIndex((branch) =>
          readValues.some((entry) => {
            const label = branch.label.trim().toLowerCase();
            const value = entry.value.trim().toLowerCase();
            return value.length > 0 && (label === value || label.startsWith(`${value} `));
          }),
        )
      : -1;

  return (
    <div
      data-testid="flow-reading-scene"
      className={`min-w-0 flex-1 rounded-lg border border-l-[3px] px-4 pb-4 pt-3.5 ${
        isParallel
          ? "border-sky-500/50 border-l-sky-500 bg-sky-500/[0.07]"
          : isCondition
            ? "border-amber-500/50 border-l-amber-500 bg-amber-500/[0.07]"
            : "border-primary/45 border-l-primary bg-primary/5"
      }`}
    >
      {stackTrail.length > 0 && (
        <div
          data-testid="flow-reading-stack"
          className="mb-2.5 flex flex-wrap items-center gap-1.5 border-b border-dashed border-border pb-2.5 text-[11.5px] text-muted-foreground"
        >
          <span className="mr-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] opacity-80">
            {t("flowReading.stack")}
          </span>
          {stackTrail.map((frame, index) => (
            <span key={frame.frameId} className="flex items-center gap-1.5">
              {index > 0 && <span className="opacity-50">›</span>}
              <button
                type="button"
                data-testid="flow-reading-stack-frame"
                onClick={onLeaveFrame}
                className="rounded-[5px] bg-secondary px-1.5 py-px font-medium text-foreground transition-colors hover:bg-surface-hover"
              >
                {frame.name}
              </button>
            </span>
          ))}
        </div>
      )}

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
        {isCondition && (
          <span
            data-testid="flow-reading-branch-glyph"
            className={conditionGlyphClass(step.conditionKind)}
          >
            {conditionGlyph(step.conditionKind)}{" "}
          </span>
        )}
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

      {isCondition && readValues.length > 0 && (
        <div data-testid="flow-reading-eval" className="mt-3 flex flex-col gap-1.5">
          {readValues.map((entry) => (
            <div
              key={entry.key}
              className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-2.5 py-2 font-mono text-[12.5px]"
            >
              <span className="text-muted-foreground">{entry.key}</span>
              <span className="font-bold text-foreground">{entry.value}</span>
              {entry.fromNumber && (
                <span className="ml-auto text-[9.5px] text-muted-foreground opacity-80">
                  {t("flowReading.fromStep", { number: entry.fromNumber })}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {isCondition && branches.length > 0 && (
        <div className="mt-3.5 flex flex-col gap-2">
          {kindNote && (
            <p
              data-testid="flow-reading-kind-note"
              className={`text-[12.5px] font-medium leading-[1.45] ${conditionGlyphClass(
                step.conditionKind,
              )}`}
            >
              {t(kindNote)}
            </p>
          )}
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
                {takenBranch === branch.index && (
                  <span
                    data-testid="flow-reading-branch-taken"
                    className="shrink-0 font-mono text-[9.5px] font-semibold uppercase tracking-[0.06em]"
                    style={{ color: branch.color }}
                  >
                    ●
                  </span>
                )}
                {isParallel && branch.visited && (
                  <span
                    data-testid="flow-reading-thread-walked"
                    className="shrink-0 rounded-[4px] bg-secondary px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
                  >
                    {t("flowReading.threadWalked")}
                  </span>
                )}
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
