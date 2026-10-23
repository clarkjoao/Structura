import { buildHandles, type HandleBehaviour } from "../CardNode/Handles";
import { useHandleSides } from "../../contexts/ReadingDirectionContext";

/**
 * The pieces every deployment element is drawn from, so the card, the
 * container and their children read as one family: the C4 card's handles
 * (left in, right out, one slot per edge, same visibility), mono chips.
 */

export function DeployHandles({
  elementId,
  incomingCount,
  outgoingCount,
}: {
  elementId: string;
  incomingCount: number;
  outgoingCount: number;
}) {
  const behaviour: HandleBehaviour = { elementId };
  const sides = useHandleSides();
  return (
    <>
      {buildHandles(incomingCount, "target", sides.input, behaviour, undefined)}
      {buildHandles(outgoingCount, "source", sides.output, behaviour, undefined)}
    </>
  );
}

/** A parameter chip: mono 11, on the muted surface — or on the accent's wash. */
export function Chip({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return (
    <span
      className="inline-block max-w-full shrink-0 truncate rounded px-1.5 py-0.5 font-mono text-[11px] leading-tight"
      style={{
        background: tone ?? "hsl(var(--muted))",
        color: "hsl(var(--secondary-foreground))",
      }}
    >
      {children}
    </span>
  );
}
