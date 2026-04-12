import type { JourneyStep } from "../types";

export function stepHasVisualMedia(step: JourneyStep): boolean {
  return Boolean(step.mediaContent || step.svgContent);
}
