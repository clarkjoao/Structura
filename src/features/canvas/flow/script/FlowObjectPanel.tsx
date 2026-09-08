import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, X } from "lucide-react";
import type { Flow, FlowStepContext } from "@/features/diagram";
import { buildFlowObject, withKey, withRead, type ObjectRow } from "./flowObject";
import { setsFromPayload, valuesFromPaste } from "./stepContext";
import type { FlowScriptActions } from "../useFlowScriptActions";

/**
 * The object the script carries, above the steps rather than inside one.
 *
 * It used to be two lists inside every expanded step — what is already set, and
 * what this step adds — and a reader had to join them in their head to know how
 * the object ends up. One panel, one object, and the step selected below is the
 * lens: *at that step, it has this value*.
 *
 * A row is one of two things. **Inherited**: dimmed, with the step that wrote
 * it. **Written here**: full contrast and editable. Typing over an inherited row
 * moves it to the second kind; the `×` moves it back. Nothing about the model
 * changes — what is edited here is the selected step's own `sets`.
 */

interface Props {
  flow: Flow;
  /** The step the object is seen from, or null for the end of the script. */
  selectedStepId: string | null;
  actions: FlowScriptActions;
}

const CELL =
  "min-w-0 flex-1 rounded border border-primary/40 bg-secondary px-1.5 py-px font-mono text-[10.5px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring";

export function FlowObjectPanel({ flow, selectedStepId, actions }: Props) {
  const { t } = useTranslation();
  const object = useMemo(() => buildFlowObject(flow, selectedStepId), [flow, selectedStepId]);
  /** Keys added here and not yet named; they reach nothing until they are. */
  const [drafts, setDrafts] = useState<string[]>([]);

  const step = selectedStepId ? flow.steps[selectedStepId] : undefined;
  const patch = (context: FlowStepContext | undefined) => {
    if (!selectedStepId) return;
    actions.updateStep(selectedStepId, { context });
  };
  const clean = (context: FlowStepContext): FlowStepContext | undefined =>
    Object.values(context).some((value) => value !== undefined) ? context : undefined;

  const setValue = (key: string, value: string | null) => {
    if (!step) return;
    patch(clean({ ...step.context, sets: withKey(step, key, value) }));
  };
  /** Several at once — a pasted block, or the keys the step's own body carries. */
  const setMany = (values: Record<string, string>) => {
    if (!step) return;
    patch(clean({ ...step.context, sets: { ...step.context?.sets, ...values } }));
  };
  const fromBody = setsFromPayload(step?.payload);
  const toggleRead = (key: string) => {
    if (!step) return;
    patch(clean({ ...step.context, reads: withRead(step, key) }));
  };

  if (object.rows.length === 0 && drafts.length === 0 && !step) return null;

  return (
    <div
      data-testid="flow-object"
      className="sticky top-0 z-10 mb-2 rounded-md border border-primary/25 bg-background/95 px-2 py-1.5 backdrop-blur"
    >
      <div className="flex items-baseline gap-2">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("flowScript.objectLabel")}
        </span>
        <span className="ml-auto font-mono text-[9px] text-muted-foreground">
          {selectedStepId
            ? t("flowScript.objectAtStep", { number: object.atNumber })
            : t("flowScript.objectAtEnd")}
        </span>
      </div>

      <p className="font-mono text-[10.5px] text-muted-foreground">{"{"}</p>
      {object.rows.map((row) => (
        <ObjectRowView
          key={row.key}
          row={row}
          editable={Boolean(step)}
          onWrite={setValue}
          onToggleRead={toggleRead}
        />
      ))}
      {drafts.map((id, index) => (
        <div key={id} className="flex items-baseline gap-1.5 py-px pl-[1.6em]">
          <input
            data-testid="flow-object-new-key"
            autoFocus
            placeholder={t("flowScript.contextKeyPlaceholder")}
            onBlur={(event) => {
              const key = event.target.value.trim();
              setDrafts((previous) => previous.filter((_, at) => at !== index));
              if (key) setValue(key, "");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            onPaste={(event) => {
              const pasted = valuesFromPaste(event.clipboardData.getData("text"));
              if (!pasted) return;
              event.preventDefault();
              setDrafts((previous) => previous.filter((_, at) => at !== index));
              setMany(pasted);
            }}
            className={`${CELL} max-w-[13ch]`}
          />
        </div>
      ))}
      {step && (
        <button
          type="button"
          data-testid="flow-object-add"
          onClick={() => setDrafts((previous) => [...previous, `draft-${previous.length}`])}
          className="flex items-center gap-1 pl-[1.6em] text-[9.5px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <Plus className="h-2.5 w-2.5" /> {t("flowScript.objectAddKey")}
        </button>
      )}
      {fromBody && (
        <button
          type="button"
          data-testid="flow-object-from-payload"
          onClick={() => setMany(fromBody)}
          title={t("flowScript.contextFromPayloadTitle")}
          className="pl-[1.6em] text-[9.5px] text-muted-foreground transition-colors hover:text-foreground"
        >
          ⤒ {t("flowScript.contextFromPayload", { count: Object.keys(fromBody).length })}
        </button>
      )}
      <p className="font-mono text-[10.5px] text-muted-foreground">{"}"}</p>
    </div>
  );
}

interface RowProps {
  row: ObjectRow;
  editable: boolean;
  onWrite: (key: string, value: string | null) => void;
  onToggleRead: (key: string) => void;
}

const ObjectRowView = ({ row, editable, onWrite, onToggleRead }: RowProps) => {
  const { t } = useTranslation();
  const unset = row.value === null;

  return (
    <div
      data-testid="flow-object-row"
      className={`flex items-baseline gap-1.5 py-px font-mono text-[10.5px] ${
        row.written ? "" : "opacity-60"
      }`}
    >
      <span className={`w-[1.1em] shrink-0 text-center ${row.written ? "text-primary" : ""}`}>
        {row.written ? "✎" : ""}
      </span>
      <span
        className={`w-[13ch] shrink-0 truncate ${unset ? "text-amber-500" : "text-json-key"}`}
        title={unset ? t("flowScript.contextReadUnset") : undefined}
      >
        "{row.key}"
      </span>
      <span className="text-muted-foreground">:</span>

      {row.written ? (
        <input
          data-testid="flow-object-value"
          value={row.value ?? ""}
          onChange={(event) => onWrite(row.key, event.target.value)}
          className={CELL}
        />
      ) : (
        <button
          type="button"
          data-testid="flow-object-inherit"
          disabled={!editable}
          title={editable ? t("flowScript.objectWriteHere") : undefined}
          onClick={() => onWrite(row.key, row.value ?? "")}
          className={`min-w-0 flex-1 truncate text-left ${
            unset ? "text-muted-foreground" : "text-json-string"
          }`}
        >
          {unset ? "—" : `"${row.value}"`}
        </button>
      )}

      <button
        type="button"
        data-testid="flow-object-read"
        aria-pressed={row.read}
        disabled={!editable}
        title={t("flowScript.objectUsesHere")}
        onClick={() => onToggleRead(row.key)}
        className={`w-[1.1em] shrink-0 text-center ${
          row.read ? "text-primary" : "text-muted-foreground opacity-30"
        }`}
      >
        ↗
      </button>

      {row.written ? (
        <button
          type="button"
          data-testid="flow-object-unwrite"
          title={t("flowScript.objectStopWriting")}
          onClick={() => onWrite(row.key, null)}
          className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      ) : (
        <span className="flex shrink-0 items-baseline gap-1.5 font-mono text-[9px]">
          {row.endsAtNumber && (
            <span
              data-testid="flow-object-ends"
              title={t("flowScript.scopeEndsAt", { number: row.endsAtNumber })}
              className="text-rose-500"
            >
              ↩ {row.endsAtNumber}
            </span>
          )}
          <span className="text-muted-foreground opacity-70">
            {row.fromNumber ? `← ${row.fromNumber}` : ""}
          </span>
        </span>
      )}
    </div>
  );
};

export default FlowObjectPanel;
