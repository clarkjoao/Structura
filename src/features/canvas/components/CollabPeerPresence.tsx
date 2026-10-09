import { Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { PeerState } from "@/features/collaboration";

interface CollabPeerPresenceProps {
  activePeer: PeerState;
  roundedClassName?: string;
  /** The peer holds the element's soft lock: it is being moved or retyped right now. */
  locked?: boolean;
}

export function CollabPeerPresence({
  activePeer,
  roundedClassName = "rounded-lg",
  locked = false,
}: CollabPeerPresenceProps) {
  const { t } = useTranslation();
  const initial = activePeer.user.name.trim().charAt(0).toUpperCase() || "?";
  const title = locked
    ? t("collaboration.lockedBy", { name: activePeer.user.name })
    : activePeer.user.name;

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-[15] ${roundedClassName}`}
      style={{
        outline: `2px ${locked ? "dashed" : "solid"} ${activePeer.user.color}`,
        outlineOffset: "3px",
      }}
    >
      <div
        className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white shadow-sm"
        style={{ backgroundColor: activePeer.user.color }}
        title={title}
        aria-label={title}
      >
        {locked ? <Lock className="h-3 w-3" aria-hidden /> : initial}
      </div>
    </div>
  );
}
