/**
 * Which edited line stands for which element (spec guided-journey-text-sync):
 * the base text's lines know their element; an edit is aligned to them by a
 * longest-common-subsequence diff on the trimmed lines. Lines kept keep their
 * element; in a run of removed lines followed by added ones (a replace), the
 * lines are paired in order, so a line edited in place — a rename, a new score —
 * stays the same element. Everything else added is new; everything else removed
 * goes, unless the same line turns up elsewhere (a moved line). Handles
 * (`{#s4}`) are resolved by the caller and override this.
 */
export function alignLines(
  baseLines: readonly string[],
  baseIds: readonly (string | null)[],
  editedLines: readonly string[],
  /** Edited line numbers (1-based) that are elements: only those take an element. */
  editedNodeLines: ReadonlySet<number>,
): Map<number, string> {
  const a = baseLines.map((line) => line.trim());
  const b = editedLines.map((line) => line.trim());
  const n = a.length;
  const m = b.length;
  // lcs[i][j]: the common length of a[i..] and b[j..], in one flat table.
  const width = m + 1;
  const lcs = new Uint32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      lcs[i * width + j] =
        a[i] === b[j]
          ? lcs[(i + 1) * width + j + 1]! + 1
          : Math.max(lcs[(i + 1) * width + j]!, lcs[i * width + j + 1]!);

  const result = new Map<number, string>();
  let removed: number[] = [];
  let added: number[] = [];
  const flush = () => {
    // A replace: as many lines out as in are edits in place, paired in order. Otherwise
    // (a line deleted next to one edited) each added line takes the removed one it most
    // resembles, and lines that resemble nothing are new or gone.
    const from = removed.filter((i) => baseIds[i]);
    const to = added.filter((j) => editedNodeLines.has(j + 1));
    if (from.length === to.length) {
      for (let k = 0; k < from.length; k++) result.set(to[k]! + 1, baseIds[from[k]!]!);
    } else {
      const pairs = to
        .flatMap((j) => from.map((i) => ({ i, j, score: similarity(a[i]!, b[j]!) })))
        .filter((p) => p.score > 0)
        .sort((x, y) => y.score - x.score || x.j - y.j);
      const usedFrom = new Set<number>();
      const usedTo = new Set<number>();
      for (const { i, j } of pairs) {
        if (usedFrom.has(i) || usedTo.has(j)) continue;
        usedFrom.add(i);
        usedTo.add(j);
        result.set(j + 1, baseIds[i]!);
      }
    }
    removed = [];
    added = [];
  };
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      flush();
      if (baseIds[i] && editedNodeLines.has(j + 1)) result.set(j + 1, baseIds[i]!);
      i++;
      j++;
    } else if (j < m && (i >= n || lcs[i * width + j + 1]! >= lcs[(i + 1) * width + j]!)) {
      added.push(j++);
    } else {
      removed.push(i++);
    }
  }
  flush();
  // A line moved unchanged (cut and pasted elsewhere) is still its element.
  const taken = new Set(result.values());
  const unclaimed = new Map<string, number[]>();
  for (let k = 0; k < n; k++) {
    const id = baseIds[k];
    if (!id || taken.has(id)) continue;
    unclaimed.set(a[k]!, [...(unclaimed.get(a[k]!) ?? []), k]);
  }
  for (let k = 0; k < m; k++) {
    if (result.has(k + 1) || !editedNodeLines.has(k + 1)) continue;
    const from = unclaimed.get(b[k]!)?.shift();
    if (from !== undefined) result.set(k + 1, baseIds[from]!);
  }
  return result;
}

/** How alike two lines are, 0–1: shared letter pairs, or a shared start. */
function similarity(x: string, y: string): number {
  const name = (line: string) =>
    line
      .replace(/\s*\{#[\w-]+\}\s*$/, "")
      .replace(/\s*\[\d+\]\s*$/, "")
      .replace(/^.*?:\s+/, "")
      .replace(/^[?!]\s*/, "")
      .toLowerCase();
  const p = name(x);
  const q = name(y);
  if (!p || !q) return 0;
  let prefix = 0;
  while (prefix < Math.min(p.length, q.length) && p[prefix] === q[prefix]) prefix++;
  const pairs = (text: string) => {
    const out = new Map<string, number>();
    for (let k = 0; k < text.length - 1; k++) {
      const pair = text.slice(k, k + 2);
      out.set(pair, (out.get(pair) ?? 0) + 1);
    }
    return out;
  };
  const pp = pairs(p);
  const qq = pairs(q);
  let shared = 0;
  for (const [pair, count] of pp) shared += Math.min(count, qq.get(pair) ?? 0);
  const total = Math.max(0, p.length - 1) + Math.max(0, q.length - 1);
  const dice = total > 0 ? (2 * shared) / total : 0;
  return Math.max(dice, prefix / Math.max(p.length, q.length));
}
