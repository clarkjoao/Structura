import type { MouseEvent, ReactNode } from "react";

export interface CardActionProps {
  icon: ReactNode;
  title: string;
  onClick: (event: MouseEvent) => void;
  variant?: "default" | "danger";
}

export function CardAction({ icon, title, onClick, variant = "default" }: CardActionProps) {
  return (
    <button
      type="button"
      draggable={false}
      title={title}
      onClick={(event) => {
        event.stopPropagation();
        onClick(event);
      }}
      style={{
        width: 28,
        height: 28,
        borderRadius: "var(--radius)",
        background: "hsl(var(--card))",
        border: "0.5px solid hsl(var(--border))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        color: variant === "danger" ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))",
      }}
    >
      {icon}
    </button>
  );
}
