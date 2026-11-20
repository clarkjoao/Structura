/**
 * The label the next step of a sequence takes after `label`: `3` → `4` on the main sequence,
 * `2a` → `2a.1` at a branch's head, `2a.1` → `2a.2` inside it. The graph renumbers on write;
 * this only names the place beforehand.
 */
export function nextStepLabel(label: string): string {
  const ordinal = /^(.*\.)(\d+)$/.exec(label);
  if (ordinal) return `${ordinal[1]}${Number(ordinal[2]) + 1}`;
  if (/^\d+$/.test(label)) return String(Number(label) + 1);
  return `${label}.1`;
}
