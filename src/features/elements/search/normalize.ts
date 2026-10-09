/** Combining marks left behind by NFD: the accents `fold` strips. */
const COMBINING_MARKS = /[̀-ͯ]/g;

/** Lowercase, accent-insensitive form of `text`: "Decisão" → "decisao". */
export function fold(text: string): string {
  return text.normalize("NFD").replace(COMBINING_MARKS, "").toLowerCase();
}

/**
 * `fold`, plus where each folded character came from in `text`.
 *
 * Folding can change a string's length (a precomposed "ã" is one code unit,
 * its NFD form two), so a match found in the folded text cannot be used as an
 * index into the original. `sourceIndex[i]` is the index in `text` of the
 * character that produced folded character `i`.
 */
export interface FoldedText {
  folded: string;
  sourceIndex: number[];
}

export function foldWithMap(text: string): FoldedText {
  let folded = "";
  const sourceIndex: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const piece = fold(text[i]);
    folded += piece;
    for (let k = 0; k < piece.length; k += 1) sourceIndex.push(i);
  }
  return { folded, sourceIndex };
}

/** A half-open `[start, end)` range in the original, unfolded text. */
export type MatchRange = readonly [start: number, end: number];

/** Maps a folded-text range back onto the text it was folded from. */
export function toSourceRange(text: FoldedText, start: number, end: number): MatchRange {
  return [text.sourceIndex[start], text.sourceIndex[end - 1] + 1];
}

/** Every occurrence of `query` in `text`, accent- and case-insensitive, as source ranges. */
export function findMatchRanges(text: string, query: string): MatchRange[] {
  const needle = fold(query.trim());
  if (!needle) return [];
  const folded = foldWithMap(text);
  const ranges: MatchRange[] = [];
  let at = folded.folded.indexOf(needle);
  while (at !== -1) {
    ranges.push(toSourceRange(folded, at, at + needle.length));
    at = folded.folded.indexOf(needle, at + needle.length);
  }
  return ranges;
}
