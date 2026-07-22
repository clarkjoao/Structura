import { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import type { InputSegment } from "@/features/canvas/chat/useMentionInput";

interface MentionInputProps {
  segments: InputSegment[];
  syncToken: number;
  onSegmentsChange: (segments: InputSegment[]) => void;
  placeholder: string;
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  disabled?: boolean;
}

function normalizeSegments(inputSegments: InputSegment[]): InputSegment[] {
  const normalizedSegments: InputSegment[] = [];
  for (const segment of inputSegments) {
    const previousSegment = normalizedSegments[normalizedSegments.length - 1];
    if (segment.kind === "text" && previousSegment?.kind === "text") {
      previousSegment.value += segment.value;
      continue;
    }
    normalizedSegments.push(segment);
  }
  return normalizedSegments.length > 0 ? normalizedSegments : [{ kind: "text", value: "" }];
}

function placeCursorAtEnd(container: HTMLDivElement | null): void {
  if (!container) {
    return;
  }
  container.focus();
  const selection = window.getSelection();
  if (!selection) {
    return;
  }
  const range = document.createRange();
  range.selectNodeContents(container);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function syncSegmentsToDOM(container: HTMLDivElement | null, segments: InputSegment[]): void {
  if (!container) {
    return;
  }
  container.innerHTML = "";
  for (const segment of segments) {
    if (segment.kind === "text") {
      container.append(document.createTextNode(segment.value));
      continue;
    }

    const mentionNode = document.createElement("span");
    mentionNode.textContent = `@${segment.label}`;
    mentionNode.setAttribute("data-segment-kind", "mention");
    mentionNode.setAttribute("data-mention-id", segment.mentionId);
    mentionNode.setAttribute("data-mention-label", segment.label);
    mentionNode.setAttribute("contenteditable", "false");
    mentionNode.className =
      "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-primary/15 text-primary";
    container.append(mentionNode);
  }
  placeCursorAtEnd(container);
}

function parseDOMToSegments(container: HTMLDivElement | null): InputSegment[] {
  if (!container) {
    return [{ kind: "text", value: "" }];
  }
  const parsedSegments: InputSegment[] = [];
  for (const node of Array.from(container.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      parsedSegments.push({ kind: "text", value: node.textContent ?? "" });
      continue;
    }
    if (!(node instanceof HTMLElement)) {
      continue;
    }
    if (node.dataset.segmentKind === "mention") {
      const mentionId = node.dataset.mentionId ?? "";
      const label = node.dataset.mentionLabel ?? "";
      if (mentionId && label) {
        parsedSegments.push({ kind: "mention", mentionId, label });
      }
      continue;
    }
    parsedSegments.push({ kind: "text", value: node.textContent ?? "" });
  }
  return normalizeSegments(parsedSegments);
}

export function MentionInput({
  segments,
  syncToken,
  onSegmentsChange,
  placeholder,
  onKeyDown,
  disabled = false,
}: MentionInputProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const hasMountedRef = useRef(false);
  const latestSegmentsRef = useRef<InputSegment[]>(segments);
  const isEmpty = useMemo(
    () => segments.every((segment) => segment.kind === "text" && segment.value.length === 0),
    [segments],
  );

  useEffect(() => {
    latestSegmentsRef.current = segments;
  }, [segments]);

  useEffect(() => {
    syncSegmentsToDOM(editorRef.current, segments);
    hasMountedRef.current = true;
  }, []);

  useEffect(() => {
    if (!hasMountedRef.current) {
      return;
    }
    syncSegmentsToDOM(editorRef.current, latestSegmentsRef.current);
  }, [syncToken]);

  return (
    <div className="relative min-w-0">
      {isEmpty ? (
        <span className="pointer-events-none absolute left-3 top-2 text-sm text-muted-foreground">
          {placeholder}
        </span>
      ) : null}
      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        dir="ltr"
        style={{
          direction: "ltr",
          textAlign: "left",
          unicodeBidi: "plaintext",
          minHeight: "2.5rem",
          maxHeight: "12rem",
          overflowY: "auto",
          overflowX: "hidden",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          overflowWrap: "anywhere",
        }}
        onInput={(event) => {
          onSegmentsChange(parseDOMToSegments(event.currentTarget));
        }}
        onKeyDown={onKeyDown}
        className={cn(
          "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          disabled && "cursor-not-allowed opacity-50",
        )}
      />
    </div>
  );
}
