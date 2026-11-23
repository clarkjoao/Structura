import type { DiagramModel } from "@/features/diagram/model/diagram.types";
import type { KindTextSuggestions } from "../kind.types";
import { readGuided } from "./guided.model";
import { guidedPhases } from "./guided.phases";

const MAX_SUGGESTIONS = 6;

/** Names starting with `prefix`, case-insensitively, the exact one left out, at most six. */
function matching(names: Iterable<string>, prefix: string): string[] {
  const lower = prefix.trim().toLowerCase();
  const out: string[] = [];
  for (const name of new Set(names)) {
    const candidate = name.toLowerCase();
    if (candidate.startsWith(lower) && candidate !== lower) out.push(name);
    if (out.length === MAX_SUGGESTIONS) break;
  }
  return out;
}

/**
 * What to offer while a line is typed (spec guided-text-workspace): step names after
 * `@`, phase names after `## `, and lane names at the start of a line, before its `: `.
 * `linePrefix` is the line up to the cursor; `from` is where the completion replaces.
 */
export function guidedSuggest(
  diagram: DiagramModel,
  linePrefix: string,
): KindTextSuggestions | null {
  const reading = readGuided(diagram);
  const jump = /@([^@]*)$/.exec(linePrefix);
  if (jump) {
    const items = matching(
      [...reading.steps.values()].filter((s) => s.flowShape !== "start").map((s) => s.name),
      jump[1]!,
    );
    return items.length
      ? { from: jump.index + 1, items: items.map((name) => ({ label: name, insert: name })) }
      : null;
  }
  const heading = /^(\s*##\s+)(.*)$/.exec(linePrefix);
  if (heading) {
    const items = matching(
      guidedPhases(reading).phases.map((p) => p.name),
      heading[2]!,
    );
    return items.length
      ? { from: heading[1]!.length, items: items.map((name) => ({ label: name, insert: name })) }
      : null;
  }
  const indent = /^\s*/.exec(linePrefix)![0].length;
  const typed = linePrefix.slice(indent);
  // Only a lane can start a line here: no colon, arrow, marker or comment yet.
  if (!typed || /[:#@]|->|→/.test(typed) || /^[?!]/.test(typed)) return null;
  const items = matching(
    reading.lanes.map((lane) => lane.name),
    typed,
  );
  return items.length
    ? { from: indent, items: items.map((name) => ({ label: name, insert: `${name}: ` })) }
    : null;
}
