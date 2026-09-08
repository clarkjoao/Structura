import type { FlowConditionKind } from "@/features/diagram";

/**
 * What each kind of branch point is called, as literal keys.
 *
 * Written out rather than built from the kind so the locale coverage check can
 * see them: a key assembled at runtime is invisible to it, and this is exactly
 * the shape of string that used to go missing from one of the two locales.
 */
export const CONDITION_KIND_LABEL: Record<FlowConditionKind, string> = {
  alt: "flowScript.conditionKind.alt",
  opt: "flowScript.conditionKind.opt",
  loop: "flowScript.conditionKind.loop",
  par: "flowScript.conditionKind.par",
  critical: "flowScript.conditionKind.critical",
  break: "flowScript.conditionKind.break",
};

/**
 * What the reading has to say about a kind beyond listing its ways out.
 *
 * Only the kinds that change what happened carry one. `alt` and `critical` are
 * a choice and nothing more, so they say nothing extra and read exactly as a
 * condition read before any of this existed — which is the property that keeps
 * every script written so far untouched.
 */
export const CONDITION_KIND_NOTE: Partial<Record<FlowConditionKind, string>> = {
  par: "flowReading.parallelAll",
  loop: "flowReading.loopRepeats",
  opt: "flowReading.optionalSkippable",
  break: "flowReading.breakStops",
};

/**
 * The mark a branch point carries.
 *
 * Three marks, not six, because there are three shapes a branch point has: `◇`
 * asks which way, `⇉` says every way at once, `↻` says the same way again. The
 * kinds that share a shape share a mark and differ in the note above, which is
 * where a fact belongs that does not change how the fork is drawn.
 *
 * Not `∥` for the parallel one, which is the notation this wants and the wrong
 * glyph to draw it with: at the sizes the rail uses, the system font closes its
 * two strokes into one bar, and one thin bar beside the call guides reads as
 * another guide. The paired arrows survive the size and say what a `par` means
 * — two things moving, not two lines.
 */
export function conditionGlyph(kind: FlowConditionKind | undefined): string {
  if (kind === "par") return "⇉";
  if (kind === "loop") return "↻";
  return "◇";
}

/** Colour of that mark — the amber of a decision, or the blue of a thread. */
export function conditionGlyphClass(kind: FlowConditionKind | undefined): string {
  return kind === "par" ? "text-sky-500" : "text-amber-600";
}
