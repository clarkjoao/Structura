import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { FlowStep, FlowStepContext } from "@/features/diagram";
import { formatSets, parseReads, parseSets, setsFromPayload } from "./stepContext";

/**
 * Writing what a step introduces, consumes and expects.
 *
 * Text, not rows of inputs: everything else in this panel is an input or a
 * textarea, and a step usually introduces one or two values. A grid of add and
 * remove buttons would cost more room than the data it holds — and the panel is
 * already the densest surface in the product.
 */

interface Props {
  step: FlowStep;
  onChange: (context: FlowStepContext | undefined) => void;
}

/** Drops the whole field once its last member is gone, so an empty step stays empty. */
function next(step: FlowStep, patch: Partial<FlowStepContext>): FlowStepContext | undefined {
  const merged: FlowStepContext = { ...step.context, ...patch };
  const cleaned: FlowStepContext = {};
  if (merged.sets && Object.keys(merged.sets).length > 0) cleaned.sets = merged.sets;
  if (merged.reads && merged.reads.length > 0) cleaned.reads = merged.reads;
  if (merged.expects?.trim()) cleaned.expects = merged.expects;
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

const FIELD =
  "w-full resize-y rounded border border-border bg-secondary px-2 py-1 font-mono text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring";

export function StepContextEditor({ step, onChange }: Props) {
  const { t } = useTranslation();
  /**
   * The text is held here, not read back from the step.
   *
   * Parsing on every keystroke and formatting the result back into the field
   * rewrites what someone is halfway through typing: the first character of a
   * key becomes a whole `key: ` line, and every character after it lands in the
   * value. So the field owns its text, and only the parsed result travels out.
   */
  const [setsText, setSetsText] = useState(() => formatSets(step.context?.sets));
  const [readsText, setReadsText] = useState(() => (step.context?.reads ?? []).join(", "));
  const promotable = setsFromPayload(step.payload);
  // Only a call that is still owed a return has something to expect back.
  const canExpect =
    Boolean(step.connectionId) && (step.payloadDirection ?? "request") === "request";

  return (
    <>
      <div className="flex items-start gap-1" onClick={(event) => event.stopPropagation()}>
        <span className="mt-1 shrink-0 text-[10px]">🧮</span>
        <div className="flex w-full flex-col gap-1">
          <textarea
            data-testid="step-context-sets"
            value={setsText}
            onChange={(event) => {
              setSetsText(event.target.value);
              onChange(next(step, { sets: parseSets(event.target.value) }));
            }}
            placeholder={t("flowScript.contextSetsPlaceholder")}
            rows={2}
            className={FIELD}
          />
          {promotable && (
            <button
              type="button"
              data-testid="step-context-from-payload"
              onClick={() => {
                setSetsText(formatSets(promotable));
                onChange(next(step, { sets: promotable }));
              }}
              title={t("flowScript.contextFromPayloadTitle")}
              className="self-start text-[9px] text-muted-foreground transition-colors hover:text-foreground"
            >
              ⤒ {t("flowScript.contextFromPayload", { count: Object.keys(promotable).length })}
            </button>
          )}
        </div>
      </div>

      <div className="flex items-start gap-1" onClick={(event) => event.stopPropagation()}>
        <span className="mt-1 shrink-0 text-[10px]">↗</span>
        <input
          data-testid="step-context-reads"
          value={readsText}
          onChange={(event) => {
            setReadsText(event.target.value);
            onChange(next(step, { reads: parseReads(event.target.value) }));
          }}
          placeholder={t("flowScript.contextReadsPlaceholder")}
          className={FIELD}
        />
      </div>

      {canExpect && (
        <div className="flex items-start gap-1" onClick={(event) => event.stopPropagation()}>
          <span className="mt-1 shrink-0 text-[10px]">🎯</span>
          <textarea
            data-testid="step-context-expects"
            value={step.context?.expects ?? ""}
            onChange={(event) => onChange(next(step, { expects: event.target.value }))}
            placeholder={t("flowScript.contextExpectsPlaceholder")}
            rows={2}
            className={FIELD}
          />
        </div>
      )}
    </>
  );
}

export default StepContextEditor;
