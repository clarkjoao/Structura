const COLORS = [
  "#6366f1",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#06b6d4",
  "#8b5cf6",
  "#f97316",
  "#ec4899",
];

export function randomColor(): string {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}
