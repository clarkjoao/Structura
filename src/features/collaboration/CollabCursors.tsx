import { useTranslation } from "react-i18next";
import type { PeerAwareness } from "./types";

interface CollabCursorsProps {
  peers: Map<number, PeerAwareness>;
}

export function CollabCursors({ peers }: CollabCursorsProps) {
  const { t } = useTranslation();

  if (peers.size === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
      {[...peers.entries()].map(([clientId, peer]) => {
        if (!peer.cursor) return null;
        return (
          <div
            key={clientId}
            className="absolute transition-transform duration-75"
            style={{ transform: `translate(${peer.cursor.x}px, ${peer.cursor.y}px)` }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M0 0L0 11L3.5 8L6 14L8 13L5.5 7H10L0 0Z"
                fill={peer.user?.color ?? "#6366f1"}
                stroke="white"
                strokeWidth="1"
              />
            </svg>
            <span
              className="absolute left-4 top-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full text-white whitespace-nowrap"
              style={{ backgroundColor: peer.user?.color ?? "#6366f1" }}
            >
              {peer.user?.name ?? t("collaboration.peerFallback")}
            </span>
          </div>
        );
      })}
    </div>
  );
}
