import { useEffect, useId, useLayoutEffect, useRef, useState, type MutableRefObject } from "react";
import { KEY, keyIs } from "@/lib/core/keyboard";
import { cn } from "@/lib/utils";
import {
  PANEL_ADD_CLASS,
  PANEL_INPUT_CLASS,
  PANEL_LABEL_CLASS,
  PANEL_TEXTAREA_CLASS,
  PANEL_TITLE_CLASS,
} from "./fieldStyles";

export interface CommitFieldProps {
  /** Omitted for a field whose label is the section it sits in. */
  label?: string;
  /** The field's accessible name when no `label` is shown. */
  ariaLabel?: string;
  value: string;
  /** Called on blur or Enter with the new value, and only when it changed. */
  onCommit: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
  /** Empty and idle, the field reads "+ <addLabel>" until clicked. */
  addLabel?: string;
  hint?: string;
  mono?: boolean;
  inputRef?: MutableRefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  className?: string;
  /**
   * `title` is the header's name: borderless until hovered, wraps instead of truncating, and
   * Enter commits like a single-line input.
   */
  variant?: "field" | "title";
  /** In a live session: take the text lock while the field has focus. */
  onFocus?: () => void;
  onBlur?: () => void;
}

/**
 * A text field that writes once per edit — on blur or Enter — like `PositionSection`,
 * instead of once per keystroke. Escape drops the draft. A draft still pending when the
 * field unmounts (the panel closed under it) is committed, not lost.
 */
export function CommitField({
  label,
  ariaLabel,
  value,
  onCommit,
  multiline = false,
  placeholder,
  addLabel,
  hint,
  mono = false,
  inputRef,
  className,
  variant = "field",
  onFocus,
  onBlur,
}: CommitFieldProps) {
  const isTitle = variant === "title";
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [revealed, setRevealed] = useState(false);
  const focusedRef = useRef(false);
  const draftRef = useRef(value);
  const valueRef = useRef(value);
  const onCommitRef = useRef(onCommit);
  const localRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  onCommitRef.current = onCommit;
  valueRef.current = value;

  // The store is not the only writer (collab, undo, the canvas), so the field follows it,
  // but never while the user is mid-edit.
  useEffect(() => {
    if (focusedRef.current) return;
    draftRef.current = value;
    setDraft(value);
  }, [value]);

  const commit = () => {
    const next = draftRef.current;
    if (next !== valueRef.current) {
      valueRef.current = next;
      onCommitRef.current(next);
    }
  };

  useEffect(
    () => () => {
      if (draftRef.current !== valueRef.current) onCommitRef.current(draftRef.current);
    },
    [],
  );

  // The description grows with its content.
  useLayoutEffect(() => {
    const el = localRef.current;
    if (!(multiline || isTitle) || !(el instanceof HTMLTextAreaElement)) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  }, [draft, multiline, isTitle, revealed]);

  const setRefs = (el: HTMLInputElement | HTMLTextAreaElement | null) => {
    localRef.current = el;
    if (inputRef) inputRef.current = el;
  };

  const showAdd = addLabel && !revealed && draft === "" && !focusedRef.current;

  const common = {
    id,
    "aria-label": label ? undefined : ariaLabel,
    value: draft,
    placeholder,
    onChange: (event: { target: { value: string } }) => {
      const next = isTitle ? event.target.value.replace(/\n/g, " ") : event.target.value;
      draftRef.current = next;
      setDraft(next);
    },
    onFocus: () => {
      focusedRef.current = true;
      onFocus?.();
    },
    onBlur: () => {
      focusedRef.current = false;
      commit();
      setRevealed(false);
      onBlur?.();
    },
  };

  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className={PANEL_LABEL_CLASS}>
          {label}
        </label>
      )}
      {showAdd ? (
        <button
          type="button"
          className={PANEL_ADD_CLASS}
          onClick={() => {
            setRevealed(true);
            requestAnimationFrame(() => localRef.current?.focus());
          }}
        >
          + {addLabel}
        </button>
      ) : multiline || isTitle ? (
        <textarea
          {...common}
          ref={setRefs}
          rows={1}
          className={cn(isTitle ? PANEL_TITLE_CLASS : PANEL_TEXTAREA_CLASS, mono && "font-mono")}
          onKeyDown={(event) => {
            if (keyIs(event, KEY.ESCAPE)) {
              draftRef.current = valueRef.current;
              setDraft(valueRef.current);
              event.currentTarget.blur();
            } else if (keyIs(event, KEY.ENTER) && (isTitle || event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
        />
      ) : (
        <input
          {...common}
          ref={setRefs}
          className={cn(PANEL_INPUT_CLASS, mono && "font-mono")}
          onKeyDown={(event) => {
            if (keyIs(event, KEY.ESCAPE)) {
              draftRef.current = valueRef.current;
              setDraft(valueRef.current);
              event.currentTarget.blur();
            } else if (keyIs(event, KEY.ENTER)) {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
        />
      )}
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
