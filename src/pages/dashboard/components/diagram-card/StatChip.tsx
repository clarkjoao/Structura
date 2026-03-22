import type { ReactNode } from "react";

export interface StatChipProps {
  icon: ReactNode;
  value: number;
  label: string;
}

export function StatChip({ icon, value, label }: StatChipProps) {
  return (
    <span
      style={{
        fontSize: 11,
        color: "hsl(var(--muted-foreground) / 0.85)",
        display: "flex",
        alignItems: "center",
        gap: 3,
      }}
    >
      {icon}
      {value} {label}
    </span>
  );
}
