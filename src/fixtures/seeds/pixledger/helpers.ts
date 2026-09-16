import type { FlowStep, NodeLayout } from "@/features/diagram";

/** Chain `.next` automatically for linear action lists (conditions keep explicit next). */
export function steps(list: FlowStep[]): Record<string, FlowStep> {
  const map: Record<string, FlowStep> = {};
  for (let i = 0; i < list.length; i++) {
    const step = list[i]!;
    const autoNext = step.type !== "condition" ? list[i + 1]?.id : undefined;
    map[step.id] = { ...step, next: step.next ?? autoNext };
  }
  return map;
}

export function layout(
  elementId: string,
  x: number,
  y: number,
  width: number,
  height: number,
): NodeLayout {
  return { elementId, x, y, width, height };
}

export const SEED_TS = {
  context: Date.parse("2026-06-01T10:00:00.000Z"),
  containers: Date.parse("2026-06-01T10:10:00.000Z"),
  deployments: Date.parse("2026-06-01T10:20:00.000Z"),
  catalog: Date.parse("2026-06-01T10:30:00.000Z"),
  updated: Date.parse("2026-09-15T12:00:00.000Z"),
} as const;
