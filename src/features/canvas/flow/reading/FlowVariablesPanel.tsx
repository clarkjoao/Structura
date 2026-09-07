import { useState } from "react";
import { useTranslation } from "react-i18next";
import JsonTree from "./JsonTree";
import type {
  ContextChange,
  ContextEntry,
  ContractCheck,
  ExpectedView,
  KeyEvent,
  PayloadView,
  RunningContext,
} from "./readingVariables";

/**
 * The object the step carries, in the shape of a debugger's Variables pane.
 *
 * Three roots, because a reader at a call has three different questions: what
 * is known by now, what goes out, and what is expected back. The running object
 * comes first and open: the payload roots are properties of the step and the
 * rail is already saying them, while it is the only root that *accumulates* —
 * and it used to be the one that cost two clicks.
 *
 * It leads with what the step in hand did to it. Without that the pane is a
 * list, and a value set twelve steps ago reads exactly like the one the step
 * being read just put there.
 *
 * The whole panel is absent when every root is: a script that carries no data
 * gets the rail it always had, divider included.
 */

interface Props {
  sends: PayloadView | null;
  expected: ExpectedView | null;
  context: RunningContext;
  /** What this step did to the running object, or null outside a reading. */
  change: ContextChange | null;
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
  /** Keys the reader is following, in the order they were pinned. */
  pinnedKeys?: readonly string[];
  onTogglePin?: (key: string) => void;
  /** The events in one key's life along the path already walked. */
  lifeOf?: (key: string) => KeyEvent[];
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

/** Named rather than built from the kind, so a new event is a type error. */
const LIFE_GLYPH: Record<KeyEvent["kind"], string> = {
  set: "⊕",
  replaced: "~",
  read: "↗",
  gone: "↩",
};

const LIFE_MARK: Record<KeyEvent["kind"], string> = {
  set: "text-json-number",
  replaced: "text-amber-500",
  read: "text-primary",
  gone: "text-rose-500",
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

/** Named rather than built, so a new state is a type error rather than a typo. */
const MARK = {
  new: { glyph: "⊕", tone: "text-json-number", key: "flowReading.newValue" },
  changed: { glyph: "~", tone: "text-amber-500", key: "flowReading.changedValue" },
  leaving: { glyph: "↩", tone: "text-rose-500", key: "flowReading.leavingNow" },
  read: { glyph: "↗", tone: "text-primary", key: "flowReading.readHere" },
} as const;

/**
 * One line of the object, and what the step in hand did to it.
 *
 * A mark in the gutter and nothing else. The words are not lost: the bar above
 * counts them — *1 novo · 1 saiu com Dashboard SPA* — and each mark carries its
 * own on hover. Badges beside the value pushed the value around and repeated
 * what the bar had just said.
 *
 * The value that was written over is not shown beside the new one either. The
 * key's life holds that: pinned, its timeline reads `1 ⊕ pro · 6 ~ enterprise`.
 */
interface EntryRowProps {
  entry: ContextEntry;
  isRead: boolean;
  isNew: boolean;
  pinned?: boolean;
  onTogglePin?: (key: string) => void;
  /** Set when this step wrote over a value already in scope. */
  changed?: boolean;
  /** Set on a value held by the call this step ends. */
  leaving?: boolean;
  numberOf: (stepId: string) => string;
  onGoToStep?: (stepId: string) => void;
}

const EntryRow = ({
  entry,
  isRead,
  isNew,
  pinned = false,
  onTogglePin,
  changed = false,
  leaving = false,
  numberOf,
  onGoToStep,
}: EntryRowProps) => {
  const { t } = useTranslation();

  const mark = leaving
    ? MARK.leaving
    : isNew
      ? MARK.new
      : changed
        ? MARK.changed
        : isRead
          ? MARK.read
          : null;

  return (
    <div
      data-testid="flow-variables-entry"
      className={`flex items-baseline gap-2 rounded-sm px-1 py-px font-mono text-[11.5px] ${
        leaving ? "opacity-50" : ""
      } ${isNew || changed ? "animate-value-flash" : ""}`}
    >
      <span
        data-testid={mark ? `flow-variables-mark-${mark.glyph}` : undefined}
        title={mark ? t(mark.key) : undefined}
        aria-label={mark ? t(mark.key) : undefined}
        className={`w-[1.1em] shrink-0 text-center ${mark ? mark.tone : ""}`}
      >
        {mark?.glyph ?? ""}
      </span>
      <button
        type="button"
        data-testid="flow-variables-pin"
        aria-pressed={pinned}
        title={t(pinned ? "flowReading.unpin" : "flowReading.pin")}
        onClick={() => onTogglePin?.(entry.key)}
        className={`w-[13ch] shrink-0 truncate text-left ${
          isRead ? "text-primary" : "text-json-key"
        } ${pinned ? "underline decoration-dotted underline-offset-2" : ""}`}
      >
        "{entry.key}"
      </button>
      <span className="text-muted-foreground">:</span>
      <span
        className={`min-w-0 flex-1 break-words ${
          isNew
            ? "font-semibold text-json-number"
            : changed
              ? "font-semibold text-amber-500"
              : "text-json-string"
        }`}
      >
        "{entry.value}"
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
};

const FlowVariablesPanel = ({
  sends,
  expected,
  context,
  change,
  contract,
  contractStepNumber,
  numberOf,
  frameName,
  onGoToStep,
  pinnedKeys = [],
  onTogglePin,
  lifeOf,
}: Props) => {
  const { t } = useTranslation();
  const [openLifeKey, setOpenLifeKey] = useState<string | null>(null);

  const hasChange = Boolean(change && !change.empty);
  // A step that ends a call has something to say even when nothing survives it.
  const hasState = context.size > 0 || context.unsetReads.length > 0 || hasChange;

  /**
   * Marking a row wants the change by entry; the bar wants it by count.
   *
   * By entry, not by key: a value written inside a call shadows one of the same
   * name outside it, and the fold keeps both, in their own frames. Looking the
   * mark up by name alone put `ALTERADO` on the older row too — on the value
   * that was replaced, which is the one thing on screen that did not change.
   */
  const markOf = (entry: ContextEntry) => `${entry.key}@${entry.fromStepId}`;
  const introduced = new Set((change?.introduced ?? []).map(markOf));
  const replaced = new Set((change?.replaced ?? []).map(markOf));
  /**
   * The values this step's return is taking, by key.
   *
   * The fold has already dropped them, so anything asking the running object
   * for one gets nothing back — which had the watch strip calling a key out of
   * scope on the very step where the list below it still showed the value,
   * dimmed, going. Both read the same set now.
   */
  const leaving = new Map(
    (change?.gone ?? []).flatMap((frame) =>
      frame.entries.map((entry) => [entry.key, { entry, frameId: frame.frameId }] as const),
    ),
  );
  const pinned = new Set(pinnedKeys);
  if (!sends && !expected && !hasState && pinnedKeys.length === 0) return null;

  const sendsLabel = sends?.direction === "response" ? "receives" : "sends";

  return (
    <div
      data-testid="flow-variables"
      className="max-h-[40%] shrink-0 overflow-y-auto border-t border-border bg-background/60 px-5 py-1.5"
    >
      {pinnedKeys.length > 0 && (
        <div data-testid="flow-variables-watch" className="flex flex-col gap-1 py-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {pinnedKeys.map((key) => {
              const held = context.byKey.get(key);
              const going = held ? undefined : leaving.get(key);
              return (
                <span key={key} className="flex items-baseline gap-1 font-mono text-[10.5px]">
                  <button
                    type="button"
                    data-testid="flow-variables-watch-key"
                    onClick={() => setOpenLifeKey(openLifeKey === key ? null : key)}
                    className="text-json-key"
                  >
                    {openLifeKey === key ? "▾" : "▸"} {key}
                  </button>
                  {held && <span className="text-json-string">{held.value}</span>}
                  {going && (
                    <span
                      data-testid="flow-variables-watch-leaving"
                      className="flex items-baseline gap-1"
                    >
                      <span className="text-json-string opacity-50">{going.entry.value}</span>
                      <span className="text-rose-500">
                        ↩ {t("flowReading.leavesWith", { name: frameName(going.frameId) })}
                      </span>
                    </span>
                  )}
                  {!held && !going && (
                    /*
                      Not hidden when the fold no longer holds it: that absence
                      *is* the answer, and it is the one place the rule about a
                      call taking its values with it explains itself.
                    */
                    <span data-testid="flow-variables-watch-gone" className="text-rose-500">
                      — {t("flowReading.outOfScope")}
                    </span>
                  )}
                  <button
                    type="button"
                    data-testid="flow-variables-unpin"
                    title={t("flowReading.unpin")}
                    onClick={() => onTogglePin?.(key)}
                    className="text-muted-foreground opacity-70 transition-opacity hover:opacity-100"
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
          {openLifeKey && (
            <div
              data-testid="flow-variables-life"
              className="flex flex-wrap items-center gap-1 font-mono text-[10px]"
            >
              {(lifeOf?.(openLifeKey) ?? []).map((event, index) => (
                <button
                  key={`${event.kind}-${event.stepId}-${index}`}
                  type="button"
                  data-testid="flow-variables-life-event"
                  onClick={() => onGoToStep?.(event.stepId)}
                  className="flex items-baseline gap-1 rounded border border-border bg-secondary px-1.5 py-px"
                >
                  <span className="text-muted-foreground">{numberOf(event.stepId)}</span>
                  <span className={LIFE_MARK[event.kind]}>{LIFE_GLYPH[event.kind]}</span>
                  {event.value !== undefined && (
                    <span className="text-json-string">{event.value}</span>
                  )}
                  {event.frameId && (
                    <span className="text-rose-500">{frameName(event.frameId)}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {hasState && (
        <Root
          id="state"
          label={t("flowReading.state")}
          hint={t("flowReading.keys", { count: context.size })}
          defaultOpen
        >
          {change && !change.empty && (
            <div
              data-testid="flow-variables-delta"
              className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded border border-border bg-secondary/60 px-1.5 py-1 font-mono text-[10px]"
            >
              {change.introduced.length > 0 && (
                <span data-testid="flow-variables-delta-new" className="text-json-number">
                  ⊕ {t("flowReading.deltaNew", { count: change.introduced.length })}
                </span>
              )}
              {change.replaced.length > 0 && (
                <span data-testid="flow-variables-delta-changed" className="text-amber-500">
                  ~ {t("flowReading.deltaChanged", { count: change.replaced.length })}
                </span>
              )}
              {change.gone.map((frame) => (
                <span
                  key={frame.frameId}
                  data-testid="flow-variables-delta-gone"
                  className="text-rose-500"
                >
                  ↩{" "}
                  {t("flowReading.deltaGone", {
                    count: frame.entries.length,
                    name: frameName(frame.frameId),
                  })}
                </span>
              ))}
            </div>
          )}

          {/*
            One object, in the order its keys arrived. It used to be split by
            the call each value was introduced inside, with each group headed by
            the *caller* of that call — so a key the Management API wrote sat
            under "Criador de Links". A reader following a script wants what is
            known now, not a lesson in frames; where a value came from is on its
            own line, and where it is going is the mark beside it.
          */}
          <p className="font-mono text-[11.5px] text-muted-foreground">{"{"}</p>
          {context.entries.map((entry) => (
            <EntryRow
              key={markOf(entry)}
              entry={entry}
              isRead={context.reads.includes(entry.key)}
              isNew={introduced.has(markOf(entry))}
              changed={replaced.has(markOf(entry))}
              pinned={pinned.has(entry.key)}
              onTogglePin={onTogglePin}
              numberOf={numberOf}
              onGoToStep={onGoToStep}
            />
          ))}

          {/*
            The values a call takes with it, shown on the step that ends it and
            gone on the next. The fold has already dropped them, so this is the
            one place they are still legible — which is the whole point of
            showing them at all.
          */}
          {(change?.gone ?? []).flatMap((frame) =>
            frame.entries.map((entry) => (
              <EntryRow
                key={markOf(entry)}
                entry={entry}
                isRead={false}
                isNew={false}
                leaving
                pinned={pinned.has(entry.key)}
                onTogglePin={onTogglePin}
                numberOf={numberOf}
                onGoToStep={onGoToStep}
              />
            )),
          )}
          <p className="font-mono text-[11.5px] text-muted-foreground">{"}"}</p>

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
    </div>
  );
};

export default FlowVariablesPanel;
