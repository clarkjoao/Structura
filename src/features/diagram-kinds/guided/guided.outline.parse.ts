/**
 * The guided journey outline (spec guided-journey-outline): a line-based text a
 * journey can be typed in as fast as notes. Parsing is pure and knows nothing of
 * the diagram; `buildOutline` resolves lanes and jumps against it.
 *
 *   Cliente: Escolhe produto        a step in a lane (a line without `Lane:` stays in the lane)
 *   ? Pagou                         a decision; its exits are indented under it
 *     sim -> API: Confirma          an exit: `label -> step | ? decision | ! end | @jump`
 *     não -> @Escolhe produto       a jump back to a step written earlier (closes the path)
 *   ! Concluído                     an end step (closes the path)
 *   API:                            declares a lane and makes it current
 *   # comment                       ignored, also after a space mid-line
 *
 * The markers are the same in every language; `\` makes the next character literal.
 */

export type OutlineErrorCode =
  | "exitOutsideDecision"
  | "exitExpected"
  | "decisionWithoutExits"
  | "exitWithoutTarget"
  | "indentUnderStep"
  | "emptyName"
  | "unreachableLine"
  | "unknownJump"
  | "ambiguousJump";

export interface OutlineError {
  /** 1-based. */
  line: number;
  code: OutlineErrorCode;
  values?: Record<string, string>;
}

export interface OutlineNode {
  kind: "step" | "decision" | "end";
  line: number;
  name: string;
  /** The lane the line names or inherits; null: the diagram's first lane. */
  lane: string | null;
  exits: OutlineExit[];
}

export interface OutlineJump {
  kind: "jump";
  line: number;
  target: string;
}

export type OutlineItem = OutlineNode | OutlineJump;

export interface OutlineExit {
  line: number;
  label: string;
  body: OutlineItem[];
}

export interface ParsedOutline {
  items: OutlineItem[];
  errors: OutlineError[];
  /** Lane names in order of first mention (declared or prefixed), as written. */
  lanes: string[];
  /** Steps, decisions and ends (jumps are not nodes). */
  nodeCount: number;
}

type Token =
  | { kind: "lane"; line: number; indent: number; lane: string }
  | { kind: "item"; line: number; indent: number; item: OutlineItem }
  | { kind: "exit"; line: number; indent: number; label: string; inline: OutlineItem | null };

/** `\` + char → the char, read literally; the mask hides escaped characters from the syntax. */
const ESCAPED = /\\(.)/g;
const unescape = (text: string) => text.replace(ESCAPED, "$1");
const mask = (text: string) => text.replace(ESCAPED, "\u0001\u0001");

const ARROW = /->|→/;

function indentOf(raw: string): number {
  let width = 0;
  for (const ch of raw) {
    if (ch === " ") width += 1;
    else if (ch === "\t") width += 2;
    else break;
  }
  return width;
}

/** Strips a comment: a leading `#`, or ` #` followed by a space or the end. */
function stripComment(content: string): string {
  const masked = mask(content);
  if (masked.startsWith("#")) return "";
  const match = /\s#(?:\s|$)/.exec(masked);
  return (match ? content.slice(0, match.index) : content).trimEnd();
}

/** A step, decision, end or jump written after an optional `Lane: ` prefix. */
function parseItemText(
  text: string,
  line: number,
  errors: OutlineError[],
): { lane: string | null; item: OutlineItem | null } {
  const masked = mask(text);
  if (masked.startsWith("@")) {
    const target = unescape(text.slice(1)).trim();
    if (!target) errors.push({ line, code: "emptyName" });
    return { lane: null, item: { kind: "jump", line, target } };
  }
  let lane: string | null = null;
  let rest = text;
  const colon = /:(?:\s|$)/.exec(masked);
  if (colon && colon.index > 0) {
    lane = unescape(text.slice(0, colon.index)).trim();
    rest = text.slice(colon.index + 1).trim();
    if (!rest) return { lane, item: null };
  }
  let kind: OutlineNode["kind"] = "step";
  const restMasked = mask(rest);
  if (restMasked.startsWith("?")) {
    kind = "decision";
    rest = rest.slice(1);
  } else if (restMasked.startsWith("!")) {
    kind = "end";
    rest = rest.slice(1);
  }
  const name = unescape(rest).trim();
  if (!name && kind !== "end") errors.push({ line, code: "emptyName" });
  return { lane, item: { kind, line, name, lane, exits: [] } };
}

function tokenize(text: string, errors: OutlineError[]): Token[] {
  const tokens: Token[] = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = index + 1;
    const content = stripComment(raw.trim());
    if (!content) return;
    const indent = indentOf(raw);
    const masked = mask(content);
    const arrow = ARROW.exec(masked);
    const after0 = arrow?.index === 0 ? content.slice(arrow[0].length).trim() : null;
    if (after0 !== null && mask(after0).startsWith("@")) {
      // `-> @Name`: a jump on its own line (under a decision: an unlabelled exit's jump).
      const target = unescape(after0.slice(1)).trim();
      if (!target) errors.push({ line, code: "emptyName" });
      tokens.push({ kind: "item", line, indent, item: { kind: "jump", line, target } });
      return;
    }
    if (arrow) {
      // `label -> …`, or `-> …` for an exit without a label.
      const label = unescape(content.slice(0, arrow.index)).trim();
      const after = content.slice(arrow.index + arrow[0].length).trim();
      let inline: OutlineItem | null = null;
      if (after) {
        const parsed = parseItemText(after, line, errors);
        inline = parsed.item;
        if (!inline) {
          // `sim -> API:`: an exit naming only the lane of what follows is not a target.
          errors.push({ line, code: "emptyName" });
        }
      }
      tokens.push({ kind: "exit", line, indent, label, inline });
      return;
    }
    const { lane, item } = parseItemText(content, line, errors);
    if (item) tokens.push({ kind: "item", line, indent, item });
    else if (lane) tokens.push({ kind: "lane", line, indent, lane });
  });
  return tokens;
}

function isClosed(item: OutlineItem | undefined): boolean {
  if (!item) return false;
  if (item.kind === "jump" || item.kind === "end") return true;
  if (item.kind === "decision")
    return (
      item.exits.length > 0 && item.exits.every((exit) => isClosed(exit.body[exit.body.length - 1]))
    );
  return false;
}

/** Builds the item tree from the structural tokens (lane declarations are not structure). */
function structure(tokens: Token[], errors: OutlineError[]): OutlineItem[] {
  const toks = tokens.filter((t): t is Exclude<Token, { kind: "lane" }> => t.kind !== "lane");
  let pos = 0;

  const skipDeeper = (indent: number) => {
    while (pos < toks.length && toks[pos]!.indent > indent) pos++;
  };

  const parseExit = (decision: OutlineNode, tok: Extract<Token, { kind: "exit" }>) => {
    pos++;
    const exit: OutlineExit = { line: tok.line, label: tok.label, body: [] };
    decision.exits.push(exit);
    const deeper = pos < toks.length && toks[pos]!.indent > tok.indent;
    if (tok.inline) {
      exit.body = deeper ? parseSequence(tok.indent, [tok.inline]) : [tok.inline];
    } else if (deeper) {
      exit.body = parseSequence(tok.indent);
    } else {
      errors.push({ line: tok.line, code: "exitWithoutTarget" });
    }
  };

  const checkDecisions = (items: OutlineItem[]) => {
    for (const item of items)
      if (item.kind === "decision" && item.exits.length === 0)
        errors.push({ line: item.line, code: "decisionWithoutExits" });
  };

  function parseSequence(parentIndent: number, initial: OutlineItem[] = []): OutlineItem[] {
    const items = [...initial];
    let seqIndent: number | null = null;
    // Exits may follow a decision at its own indentation too, until another item comes.
    let acceptsExits = initial[initial.length - 1]?.kind === "decision";
    while (pos < toks.length) {
      const tok = toks[pos]!;
      if (tok.indent <= parentIndent) break;
      seqIndent ??= tok.indent;
      if (tok.indent > seqIndent) {
        errors.push({ line: tok.line, code: "indentUnderStep" });
        skipDeeper(seqIndent);
        continue;
      }
      const last = items[items.length - 1];
      if (tok.kind === "exit") {
        if (last?.kind === "decision" && acceptsExits) {
          parseExit(last, tok);
        } else {
          errors.push({ line: tok.line, code: "exitOutsideDecision" });
          pos++;
          skipDeeper(tok.indent);
        }
        continue;
      }
      pos++;
      if (isClosed(last)) errors.push({ line: tok.line, code: "unreachableLine" });
      const item = tok.item;
      items.push(item);
      acceptsExits = item.kind === "decision";
      if (pos < toks.length && toks[pos]!.indent > tok.indent) {
        if (item.kind !== "decision") {
          errors.push({ line: toks[pos]!.line, code: "indentUnderStep" });
          skipDeeper(tok.indent);
          continue;
        }
        const exitIndent = toks[pos]!.indent;
        while (pos < toks.length && toks[pos]!.indent > tok.indent) {
          const raw = toks[pos]!;
          // `-> @Name` directly under a decision: an exit without a label that jumps.
          const t: Token =
            raw.kind === "item" && raw.item.kind === "jump"
              ? { kind: "exit", line: raw.line, indent: raw.indent, label: "", inline: raw.item }
              : raw;
          if (t.kind !== "exit" || t.indent > exitIndent) {
            errors.push({ line: t.line, code: "exitExpected" });
            pos++;
            skipDeeper(t.indent);
            continue;
          }
          parseExit(item, t);
        }
      }
    }
    checkDecisions(items);
    return items;
  }

  const items = parseSequence(-1);
  // Anything left is shallower than the first line: read as a fresh run at top level.
  while (pos < toks.length) items.push(...parseSequence(-1));
  return items;
}

/** Each node's lane, in reading order: named, else the one before it. */
function resolveLanes(tokens: Token[]): string[] {
  const lanes: string[] = [];
  const seen = new Set<string>();
  const note = (lane: string) => {
    const key = lane.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    lanes.push(lane);
  };
  let current: string | null = null;
  const visit = (item: OutlineItem | null) => {
    if (!item || item.kind === "jump") return;
    if (item.lane) current = item.lane;
    else item.lane = current;
    if (item.lane) note(item.lane);
  };
  for (const token of tokens) {
    if (token.kind === "lane") {
      current = token.lane;
      note(token.lane);
    } else if (token.kind === "item") visit(token.item);
    else visit(token.inline);
  }
  return lanes;
}

function countNodes(items: OutlineItem[]): number {
  let count = 0;
  for (const item of items) {
    if (item.kind === "jump") continue;
    count += 1;
    for (const exit of item.exits) count += countNodes(exit.body);
  }
  return count;
}

export function parseOutline(text: string): ParsedOutline {
  const errors: OutlineError[] = [];
  const tokens = tokenize(text, errors);
  const lanes = resolveLanes(tokens);
  const items = structure(tokens, errors);
  errors.sort((a, b) => a.line - b.line);
  return { items, errors, lanes, nodeCount: countNodes(items) };
}

/** Escapes text so the parser reads it back as a name (or an exit label). */
export function escapeOutlineText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/->/g, "\\->")
    .replace(/→/g, "\\→")
    .replace(/(\s)#/g, "$1\\#")
    .replace(/^([?!#@])/, "\\$1");
}
