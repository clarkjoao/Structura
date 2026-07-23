/**
 * Note rendering for draw.io. Notes carry markdown in Structura; draw.io shows
 * raw text, so we render a small markdown subset to HTML (the note cell is
 * `html=1`) and size the box to the content instead of a fixed tall rectangle.
 */

function inlineMarkdown(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<i>$2</i>")
    .replace(/_(.+?)_/g, "<i>$1</i>");
}

function renderLine(line: string): string {
  const h3 = /^###\s+(.*)$/.exec(line);
  if (h3) return `<b style="font-size:13px">${inlineMarkdown(h3[1])}</b>`;
  const h2 = /^##\s+(.*)$/.exec(line);
  if (h2) return `<b style="font-size:15px">${inlineMarkdown(h2[1])}</b>`;
  const h1 = /^#\s+(.*)$/.exec(line);
  if (h1) return `<b style="font-size:18px">${inlineMarkdown(h1[1])}</b>`;
  const li = /^\s*[-*]\s+(.*)$/.exec(line);
  if (li) return `• ${inlineMarkdown(li[1])}`;
  return inlineMarkdown(line);
}

/**
 * Render a markdown subset (h1–h3, bold, italic, bullet lists) to inline HTML
 * suitable for a draw.io `html=1` value. Returned string is NOT XML-escaped —
 * the caller escapes it into the cell attribute (draw.io un-escapes + renders).
 */
export function renderNoteHtml(text: string): string {
  return text.split("\n").map(renderLine).join("<br>");
}

/**
 * Rough content-fit height (px) for a note of the given width, so exported notes
 * track their content instead of the fixed 336×475 box. Grows with content, so
 * long notes are never clipped; floors at a small minimum.
 */
export function estimateNoteHeight(text: string, width: number): number {
  const charsPerLine = Math.max(12, Math.floor((width - 16) / 7));
  let visualLines = 0;
  for (const raw of text.split("\n")) {
    const stripped = raw.replace(/^#{1,3}\s+/, "").replace(/^\s*[-*]\s+/, "");
    visualLines += Math.max(1, Math.ceil((stripped.length || 1) / charsPerLine));
  }
  return Math.max(48, visualLines * 20 + 24);
}
