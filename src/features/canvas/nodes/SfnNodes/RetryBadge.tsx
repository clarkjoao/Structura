import { RotateCw } from "lucide-react";

/**
 * A state's retry, as a badge pinned to its top right: amber, mono, with the
 * circular arrow. A representation of the state's `retry[]`, not a node.
 */
export function RetryBadge({ text }: { text: string }) {
  return (
    <span
      className="pointer-events-none absolute -top-2.5 right-2 flex select-none items-center gap-1 rounded-full px-1.5 font-mono text-[10px] leading-4"
      style={{
        background: "hsl(var(--card))",
        border: "1px solid hsl(var(--node-person))",
        color: "hsl(var(--foreground))",
      }}
    >
      <RotateCw size={10} strokeWidth={2} color="hsl(var(--node-person))" aria-hidden />
      {text}
    </span>
  );
}
