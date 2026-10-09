import type { MatchRange } from "@/features/elements/search";

interface HighlightedTextProps {
  text: string;
  ranges: readonly MatchRange[];
}

/** `text` with the matched ranges marked, for search results. */
export function HighlightedText({ text, ranges }: HighlightedTextProps) {
  if (ranges.length === 0) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach(([start, end], index) => {
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(
      <mark key={index} className="rounded-sm bg-primary/15 px-px text-foreground">
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}
