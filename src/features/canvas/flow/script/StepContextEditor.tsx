import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, X } from "lucide-react";
import type { FlowStep, FlowStepContext } from "@/features/diagram";
import { JsonField } from "./JsonField";
import {
  fromSetRows,
  newSetRow,
  rowsFromPaste,
  setsFromPayload,
  toSetRows,
  type SetRow,
} from "./stepContext";

/**
 * Writing what a step introduces, consumes and expects — against the state it
 * is being written into.
 *
 * The scope comes first and is read-only: the running object the reading holds
 * when it stands on this step, less what the step itself contributes. It is the
 * same fold the reading calls, given the same path, which is the only way the
 * two cannot drift — folding a shorter path looked equivalent and was not, so
 * the panel offered keys the reading then reported as defined by nobody.
 *
 * It is grouped by the call each value was introduced inside, and a group whose
 * call ends later says where: a value can be perfectly readable here and gone
 * by the next step, and nothing used to say so.
 */

interface Props {
  step: FlowStep;
  /** In scope where this step runs, innermost call first. */
  scope: readonly ScopeGroup[];
  onChange: (context: FlowStepContext | undefined) => void;
}

export interface ScopeEntry {
  key: string;
  value: string;
  /** Derived label of the step that set it — `3`, `4a.1`. */
  fromNumber: string;
}

/** The values one call holds, and when that call gives them up. */
export interface ScopeGroup {
  /** null on the outermost level, which has no call to name. */
  frameId: string | null;
  /** The component the call returns to; null outside every call. */
  name: string | null;
  /** Number of the step that ends this call, when the script writes one. */
  endsAtNumber: string | null;
  entries: ScopeEntry[];
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

const CELL =
  "min-w-0 rounded border border-border bg-secondary px-1.5 py-1 font-mono text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring";

const SECTION = "text-[9px] font-semibold uppercase tracking-wider text-muted-foreground";

export function StepContextEditor({ step, scope, onChange }: Props) {
  const { t } = useTranslation();

  /**
   * The rows are held here, not rebuilt from the step on every render: a row
   * whose key is still being typed has no key yet, and rebuilding from the
   * object would drop it mid-word.
   */
  const [rows, setRows] = useState<SetRow[]>(() => toSetRows(step.context?.sets));
  const [pendingRead, setPendingRead] = useState("");

  /**
   * A row opened from the keyboard has to take focus, and it does not exist yet
   * when the key that opened it is handled — so the id is remembered and the
   * focus happens once the row has rendered.
   */
  const keyCells = useRef(new Map<string, HTMLInputElement | null>());
  const [focusRowId, setFocusRowId] = useState<string | null>(null);
  useEffect(() => {
    if (!focusRowId) return;
    keyCells.current.get(focusRowId)?.focus();
    setFocusRowId(null);
  }, [focusRowId, rows]);

  /** The groups are for reading; the chips and the shadow marker want a list. */
  const inScope = scope.flatMap((group) => group.entries);
  const reads = step.context?.reads ?? [];
  const promotable = setsFromPayload(step.payload);
  // Only a call that is still owed a return has something to expect back.
  const canExpect =
    Boolean(step.connectionId) && (step.payloadDirection ?? "request") === "request";

  const writeRows = (nextRows: SetRow[]) => {
    setRows(nextRows);
    onChange(next(step, { sets: fromSetRows(nextRows) }));
  };

  /** Enter on the last row opens the next one; earlier rows already have one. */
  const openNextRow = (index: number) => {
    if (index !== rows.length - 1 || !rows[index]?.key.trim()) return;
    const row = newSetRow();
    writeRows([...rows, row]);
    setFocusRowId(row.id);
  };

  /**
   * A row with no key reaches nothing, so one abandoned mid-thought should not
   * be left on screen looking like part of the step. Only on the way out: a key
   * being typed is empty for exactly as long as it takes to type the first
   * character.
   */
  const pruneEmptyRows = () => {
    const kept = rows.filter((row) => row.key.trim());
    // `fromSetRows` already ignored them, so the step cannot change here.
    if (kept.length !== rows.length) setRows(kept);
  };

  const toggleRead = (key: string) => {
    const nextReads = reads.includes(key) ? reads.filter((k) => k !== key) : [...reads, key];
    onChange(next(step, { reads: nextReads.length > 0 ? nextReads : undefined }));
  };

  const addPendingRead = () => {
    const key = pendingRead.trim();
    if (!key || reads.includes(key)) return;
    setPendingRead("");
    onChange(next(step, { reads: [...reads, key] }));
  };

  /** In scope, plus any key this step already reads that nothing sets. */
  const readable = [...inScope.map((entry) => entry.key)];
  for (const key of reads) if (!readable.includes(key)) readable.push(key);

  return (
    <div className="flex flex-col gap-2 pt-1" onClick={(event) => event.stopPropagation()}>
      {scope.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className={SECTION}>{t("flowScript.scopeHere")}</span>
          <div
            data-testid="step-context-scope"
            className="flex flex-col rounded border border-border bg-secondary/50 px-1.5 py-1"
          >
            {scope.map((group) => (
              <div key={group.frameId ?? "outer"} className="mb-1 last:mb-0">
                <div className="flex flex-wrap items-baseline gap-x-1.5">
                  <span className="text-[8.5px] font-semibold uppercase tracking-wider text-muted-foreground opacity-90">
                    {group.name ?? t("flowScript.scopeOuter")}
                  </span>
                  {group.endsAtNumber && (
                    <span
                      data-testid="step-context-scope-ends"
                      className="whitespace-nowrap font-mono text-[8.5px] text-muted-foreground"
                    >
                      ↩ {t("flowScript.scopeEndsAt", { number: group.endsAtNumber })}
                    </span>
                  )}
                </div>
                {group.entries.map((entry) => (
                  <div key={entry.key} className="flex items-baseline gap-2 font-mono text-[10px]">
                    <span className="shrink-0 text-muted-foreground">{entry.key}</span>
                    <span className="min-w-0 flex-1 truncate text-foreground">{entry.value}</span>
                    <span className="shrink-0 text-[9px] text-muted-foreground opacity-70">
                      {entry.fromNumber}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        className="flex flex-col gap-1"
        onBlur={(event) => {
          if (event.currentTarget.contains(event.relatedTarget)) return;
          pruneEmptyRows();
        }}
      >
        <div className="flex items-center justify-between">
          <span className={SECTION}>{t("flowScript.contextSets")}</span>
          <button
            type="button"
            data-testid="step-context-add-set"
            onClick={() => writeRows([...rows, newSetRow()])}
            title={t("flowScript.contextAddSet")}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>

        {rows.map((row, index) => {
          // Writing a key that is already set is not a mistake — it is the
          // ordinary way a value moves on — but it is worth seeing, the way a
          // debugger shows you the frame a name came from.
          const shadowed = inScope.find((entry) => entry.key === row.key.trim());
          return (
            <div key={row.id} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] gap-1">
              <input
                data-testid="step-context-set-key"
                ref={(node) => {
                  keyCells.current.set(row.id, node);
                }}
                value={row.key}
                onChange={(event) =>
                  writeRows(
                    rows.map((r, i) => (i === index ? { ...r, key: event.target.value } : r)),
                  )
                }
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  openNextRow(index);
                }}
                onPaste={(event) => {
                  const pasted = rowsFromPaste(event.clipboardData.getData("text"));
                  if (!pasted) return;
                  event.preventDefault();
                  writeRows([...rows.slice(0, index), ...pasted, ...rows.slice(index + 1)]);
                }}
                placeholder={t("flowScript.contextKeyPlaceholder")}
                className={CELL}
              />
              <input
                data-testid="step-context-set-value"
                value={row.value}
                onChange={(event) =>
                  writeRows(
                    rows.map((r, i) => (i === index ? { ...r, value: event.target.value } : r)),
                  )
                }
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  openNextRow(index);
                }}
                placeholder={t("flowScript.contextValuePlaceholder")}
                className={CELL}
              />
              <button
                type="button"
                data-testid="step-context-remove-set"
                onClick={() => writeRows(rows.filter((_, i) => i !== index))}
                title={t("flowScript.contextRemoveSet")}
                className="text-muted-foreground transition-colors hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
              {shadowed && (
                <span
                  data-testid="step-context-shadows"
                  title={t("flowScript.contextShadows", { number: shadowed.fromNumber })}
                  className="col-span-3 -mt-0.5 font-mono text-[8.5px] text-muted-foreground"
                >
                  ↺ {t("flowScript.contextShadows", { number: shadowed.fromNumber })}
                </span>
              )}
            </div>
          );
        })}

        {promotable && (
          <button
            type="button"
            data-testid="step-context-from-payload"
            onClick={() => writeRows(toSetRows(promotable))}
            title={t("flowScript.contextFromPayloadTitle")}
            className="self-start text-[9px] text-muted-foreground transition-colors hover:text-foreground"
          >
            ⤒ {t("flowScript.contextFromPayload", { count: Object.keys(promotable).length })}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <span className={SECTION}>{t("flowScript.contextReads")}</span>
        <div className="flex flex-wrap items-center gap-1">
          {readable.map((key) => {
            const on = reads.includes(key);
            // The reading reports this key as defined by nobody. Saying so here
            // is the difference between finding out now and finding out while
            // reading the script back.
            const unset = !inScope.some((entry) => entry.key === key);
            return (
              <button
                key={key}
                type="button"
                data-testid={unset ? "step-context-read-unset" : "step-context-read-chip"}
                aria-pressed={on}
                title={unset ? t("flowScript.contextReadUnset") : undefined}
                onClick={() => toggleRead(key)}
                className={`rounded-full border px-1.5 py-px font-mono text-[9.5px] transition-colors ${
                  unset
                    ? "border-amber-500/60 bg-amber-500/10 text-amber-500"
                    : on
                      ? "border-primary bg-primary/15 text-foreground"
                      : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {key}
              </button>
            );
          })}
          <input
            data-testid="step-context-read-new"
            value={pendingRead}
            onChange={(event) => setPendingRead(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              addPendingRead();
            }}
            onBlur={addPendingRead}
            placeholder={t("flowScript.contextReadsPlaceholder")}
            className={`${CELL} w-24`}
          />
        </div>
      </div>

      {canExpect && (
        <JsonField
          testId="step-context-expects"
          label={t("flowScript.contextExpects")}
          value={step.context?.expects ?? ""}
          onChange={(value) => onChange(next(step, { expects: value }))}
        />
      )}
    </div>
  );
}

export default StepContextEditor;
