import { useState } from "react";
import { useTranslation } from "react-i18next";
import JsonTree from "./JsonTree";
import type { ContractCheck, ExpectedView, PayloadView, RunningContext } from "./readingVariables";

/**
 * The object the step carries, in the shape of a debugger's Variables pane.
 *
 * Three roots, because a reader at a call has three different questions: what
 * goes out, what is expected back, and what is known by now. They are collapsed
 * separately and the state root starts shut — it is the one that grows with the
 * script, while the payload roots stay the size of one body.
 *
 * The whole panel is absent when every root is: a script that carries no data
 * gets the rail it always had, divider included.
 */

interface Props {
  sends: PayloadView | null;
  expected: ExpectedView | null;
  context: RunningContext;
  /** Set on a response step whose call declared what it expected. */
  contract: ContractCheck | null;
  /** Step number of the call being answered, for the contract line. */
  contractStepNumber?: string;
  /** Names a step by its reading number, for the `from step 4` attributions. */
  numberOf: (stepId: string) => string;
  /** Names a call by the component it returns to. */
  frameName: (frameId: string) => string;
  /** Moves the reading to the step that introduced a value. */
  onGoToStep?: (stepId: string) => void;
}

interface RootProps {
  id: string;
  label: string;
  hint?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const Root = ({ id, label, hint, defaultOpen = false, children }: RootProps) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div data-testid={`flow-variables-root-${id}`}>
      <button
        type="button"
        data-testid={`flow-variables-toggle-${id}`}
        aria-expanded={open}
        onClick={() => setOpen((previous) => !previous)}
        className="flex w-full items-center gap-[7px] border-t border-border/70 py-1.5 text-left first:border-t-0"
      >
        <span className="w-[9px] shrink-0 font-mono text-[9px] text-muted-foreground">
          {open ? "▾" : "▸"}
        </span>
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-foreground">
          {label}
        </span>
        {hint && (
          <span className="ml-auto truncate font-mono text-[9.5px] text-muted-foreground opacity-85">
            {hint}
          </span>
        )}
      </button>
      {open && <div className="ml-1 border-l border-border pl-3 pb-2">{children}</div>}
    </div>
  );
};

/** A payload the author wrote as prose rather than as an object. */
const PayloadBody = ({ payload }: { payload: PayloadView }) =>
  payload.json ? (
    <JsonTree value={payload.json} />
  ) : (
    <p
      data-testid="flow-variables-text"
      className="whitespace-pre-wrap font-mono text-[11.5px] leading-[1.5] text-foreground"
    >
      {payload.text}
    </p>
  );

const FlowVariablesPanel = ({
  sends,
  expected,
  context,
  contract,
  contractStepNumber,
  numberOf,
  frameName,
  onGoToStep,
}: Props) => {
  const { t } = useTranslation();

  const hasState = context.size > 0 || context.unsetReads.length > 0;
  if (!sends && !expected && !hasState) return null;

  const sendsLabel = sends?.direction === "response" ? "receives" : "sends";

  return (
    <div
      data-testid="flow-variables"
      className="max-h-[40%] shrink-0 overflow-y-auto border-t border-border bg-background/60 px-5 py-1.5"
    >
      {sends && (
        <Root
          id="sends"
          label={t(`flowReading.${sendsLabel}`)}
          hint={
            sends.json ? t("flowReading.fields", { count: Object.keys(sends.json).length }) : ""
          }
          defaultOpen
        >
          <PayloadBody payload={sends} />
          {contract && (
            <p
              data-testid="flow-variables-contract"
              className="mt-2 font-mono text-[10px] leading-[1.5] text-muted-foreground"
            >
              {contract.matches ? (
                <span className="text-json-number">
                  ✓ {t("flowReading.contractMatches", { number: contractStepNumber ?? "" })}
                </span>
              ) : (
                <>
                  {contract.missing.length > 0 && (
                    <span className="block">
                      {t("flowReading.contractMissing", { keys: contract.missing.join(", ") })}
                    </span>
                  )}
                  {contract.unexpected.length > 0 && (
                    <span className="block">
                      {t("flowReading.contractUnexpected", {
                        keys: contract.unexpected.join(", "),
                      })}
                    </span>
                  )}
                </>
              )}
            </p>
          )}
        </Root>
      )}

      {expected && (
        <Root
          id="expects"
          label={t("flowReading.expects")}
          hint={
            expected.fromStepId
              ? t("flowReading.fromStep", { number: numberOf(expected.fromStepId) })
              : undefined
          }
          defaultOpen={!expected.nothingComesBack}
        >
          {expected.nothingComesBack || !expected.payload ? (
            <p
              data-testid="flow-variables-nothing"
              className="font-mono text-[11px] italic text-muted-foreground"
            >
              {t("flowReading.nothingComesBack")}
            </p>
          ) : (
            <div className="opacity-85">
              <PayloadBody payload={expected.payload} />
            </div>
          )}
        </Root>
      )}

      {hasState && (
        <Root
          id="state"
          label={t("flowReading.state")}
          hint={t("flowReading.keys", { count: context.size })}
        >
          {context.groups.map((group) => (
            <div key={group.frameId ?? "outer"} className="mb-1.5 last:mb-0">
              <span className="block font-mono text-[9.5px] font-semibold uppercase tracking-[0.11em] text-muted-foreground opacity-85">
                {group.frameId ? frameName(group.frameId) : t("flowReading.outerScope")}
              </span>
              {group.entries.map((entry) => {
                const isRead = context.reads.includes(entry.key);
                return (
                  <div
                    key={entry.key}
                    data-testid="flow-variables-entry"
                    className="flex items-baseline gap-2 py-px font-mono text-[11.5px]"
                  >
                    <span className={isRead ? "text-primary" : "text-json-key"}>
                      {isRead ? "↗ " : ""}
                      {entry.key}
                    </span>
                    <span className="text-muted-foreground">:</span>
                    <span className="min-w-0 flex-1 break-words text-json-string">
                      {entry.value}
                    </span>
                    <button
                      type="button"
                      data-testid="flow-variables-origin"
                      onClick={() => onGoToStep?.(entry.fromStepId)}
                      className="shrink-0 font-mono text-[9.5px] text-muted-foreground opacity-80 transition-opacity hover:opacity-100"
                    >
                      ← {numberOf(entry.fromStepId)}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
          {context.unsetReads.length > 0 && (
            <p
              data-testid="flow-variables-unset"
              className="mt-1.5 font-mono text-[10px] leading-[1.5] text-amber-600"
            >
              {t("flowReading.unsetRead", { keys: context.unsetReads.join(", ") })}
            </p>
          )}
        </Root>
      )}
    </div>
  );
};

export default FlowVariablesPanel;
