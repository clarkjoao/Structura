import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import type { KindTextSuggestions } from "@/features/diagram-kinds/kind.types";
import { cn } from "@/lib/utils";

/** The editor's line height in px: the gutter rows and the scroll to a line follow it. */
const LINE_HEIGHT = 18;

/** The 1-based line the caret is on. */
const lineAt = (text: string, offset: number) => text.slice(0, offset).split("\n").length;

/**
 * The whole-journey text with a gutter (spec guided-text-workspace): line numbers,
 * a marker on each line with an error, the line of the selected step highlighted;
 * the caret's line reported as it moves, and completions offered for the line typed.
 * A textarea, so typing stays native; the gutter scrolls with it.
 */
export function KindJourneyEditor({
  value,
  onChange,
  onKeyDown,
  textareaRef,
  errorsByLine,
  highlightLine,
  onCaretLine,
  suggest,
  ariaLabel,
  invalid,
  rows = 14,
}: {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  textareaRef: RefObject<HTMLTextAreaElement>;
  /** Error messages by 1-based line. */
  errorsByLine: ReadonlyMap<number, string>;
  /** The 1-based line to highlight and bring into view (the selected step's). */
  highlightLine: number | null;
  onCaretLine?: (line: number) => void;
  suggest?: (linePrefix: string) => KindTextSuggestions | null;
  ariaLabel: string;
  invalid: boolean;
  rows?: number;
}) {
  const gutterRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [completion, setCompletion] = useState<{
    lineStart: number;
    caret: number;
    suggestions: KindTextSuggestions;
    index: number;
  } | null>(null);
  const lines = value.split("\n").length;

  // The selected step's line, scrolled into view when it is outside it.
  useEffect(() => {
    const area = textareaRef.current;
    if (!area || highlightLine === null) return;
    const top = (highlightLine - 1) * LINE_HEIGHT;
    if (top < area.scrollTop || top > area.scrollTop + area.clientHeight - LINE_HEIGHT)
      area.scrollTop = Math.max(0, top - area.clientHeight / 3);
  }, [highlightLine, textareaRef]);

  const readCaret = () => {
    const area = textareaRef.current;
    if (!area) return;
    const caret = area.selectionStart;
    onCaretLine?.(lineAt(area.value, caret));
    if (!suggest || area.selectionEnd !== caret) {
      setCompletion(null);
      return;
    }
    const lineStart = area.value.lastIndexOf("\n", caret - 1) + 1;
    const suggestions = suggest(area.value.slice(lineStart, caret));
    setCompletion(suggestions ? { lineStart, caret, suggestions, index: 0 } : null);
  };

  const accept = (index: number) => {
    const area = textareaRef.current;
    if (!area || !completion) return;
    const item = completion.suggestions.items[index]!;
    const from = completion.lineStart + completion.suggestions.from;
    const next = value.slice(0, from) + item.insert + value.slice(completion.caret);
    onChange(next);
    setCompletion(null);
    const caret = from + item.insert.length;
    requestAnimationFrame(() => {
      area.focus();
      area.setSelectionRange(caret, caret);
    });
  };

  return (
    <div className="relative">
      <div className="flex overflow-hidden rounded-md border border-border bg-background focus-within:ring-1 focus-within:ring-ring">
        <div
          ref={gutterRef}
          aria-hidden
          className="select-none overflow-hidden border-r border-border bg-muted/40 py-2 text-right font-mono text-[10px] text-muted-foreground"
          style={{ width: 34, lineHeight: `${LINE_HEIGHT}px` }}
          data-testid="kind-text-gutter"
        >
          <div style={{ transform: `translateY(${-scrollTop}px)` }}>
            {Array.from({ length: lines }, (_, i) => {
              const line = i + 1;
              const error = errorsByLine.get(line);
              return (
                <div
                  key={line}
                  title={error}
                  className={cn(
                    "flex items-center justify-end gap-1 pr-1.5",
                    line === highlightLine && "bg-primary/15 text-foreground",
                    error && "text-destructive",
                  )}
                  style={{ height: LINE_HEIGHT }}
                  data-testid={error ? "kind-text-gutter-error" : undefined}
                  data-line={line}
                >
                  {error && <span className="h-1.5 w-1.5 rounded-full bg-destructive" />}
                  {line}
                </div>
              );
            })}
          </div>
        </div>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (completion) {
              const count = completion.suggestions.items.length;
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                event.stopPropagation();
                const step = event.key === "ArrowDown" ? 1 : -1;
                setCompletion({ ...completion, index: (completion.index + step + count) % count });
                return;
              }
              if (
                (event.key === "Tab" || event.key === "Enter") &&
                !event.metaKey &&
                !event.ctrlKey
              ) {
                event.preventDefault();
                event.stopPropagation();
                accept(completion.index);
                return;
              }
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                setCompletion(null);
                return;
              }
            }
            onKeyDown(event);
          }}
          onKeyUp={(event) => {
            if (
              ["ArrowDown", "ArrowUp", "Tab", "Enter", "Escape"].includes(event.key) &&
              completion
            )
              return;
            readCaret();
          }}
          onClick={readCaret}
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
          onBlur={() => setCompletion(null)}
          spellCheck={false}
          rows={rows}
          aria-label={ariaLabel}
          aria-invalid={invalid}
          className="min-h-0 w-full resize-y bg-transparent px-2 py-2 font-mono text-xs text-foreground outline-none"
          style={{ lineHeight: `${LINE_HEIGHT}px` }}
          data-testid="kind-text-journey"
        />
      </div>
      {completion && (
        <ul
          role="listbox"
          className="absolute left-10 z-20 mt-1 min-w-40 rounded-md border border-border bg-card py-1 text-xs shadow-md"
          data-testid="kind-text-suggestions"
        >
          {completion.suggestions.items.map((item, index) => (
            <li
              key={item.insert}
              role="option"
              aria-selected={index === completion.index}
              onMouseDown={(event) => {
                event.preventDefault();
                accept(index);
              }}
              className={cn(
                "cursor-pointer px-2 py-0.5 text-foreground",
                index === completion.index && "bg-muted",
              )}
            >
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
