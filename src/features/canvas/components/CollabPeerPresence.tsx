import type { PeerState } from "@/features/collaboration";

interface CollabPeerPresenceProps {
  activePeer: PeerState;
  roundedClassName?: string;
}

export function CollabPeerPresence({
  activePeer,
  roundedClassName = "rounded-lg",
}: CollabPeerPresenceProps) {
  const initial = activePeer.user.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-[15] ${roundedClassName}`}
      style={{
        outline: `2px solid ${activePeer.user.color}`,
        outlineOffset: "3px",
      }}
    >
      <div
        className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white shadow-sm"
        style={{ backgroundColor: activePeer.user.color }}
        title={activePeer.user.name}
      >
        {initial}
      </div>
    </div>
  );
}
