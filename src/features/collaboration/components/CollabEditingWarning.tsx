import type { ReactNode } from "react";
import { Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCollab } from "./CollabProvider";
import type { CollabUser } from "../types";

interface CollabEditingWarningProps {
  elementId: string | null;
}

function PeerBadge({ user }: { user: CollabUser }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5
                 text-[10px] font-semibold text-white whitespace-nowrap"
      style={{ backgroundColor: user.color }}
    >
      {user.name}
    </span>
  );
}

function buildWarningMessage(
  peers: CollabUser[],
  t: (key: string, opts?: Record<string, unknown>) => string,
): ReactNode {
  if (peers.length === 0) return null;

  const badges = peers.map((peer, index) => (
    <span key={peer.id} className="inline-flex items-center gap-1">
      {index > 0 && (
        <span className="text-amber-600 dark:text-amber-400">
          {index === peers.length - 1
            ? ` ${t("collaboration.and")} `
            : ", "}
        </span>
      )}
      <PeerBadge user={peer} />
    </span>
  ));

  const suffix =
    peers.length === 1
      ? t("collaboration.alsoEditingSuffix_one")
      : t("collaboration.alsoEditingSuffix_other");

  return (
    <span className="flex flex-wrap items-center gap-1">
      {badges}
      <span className="text-amber-600 dark:text-amber-400">{suffix}</span>
    </span>
  );
}

export function CollabEditingWarning({ elementId }: CollabEditingWarningProps) {
  const { t } = useTranslation();
  const { session } = useCollab();

  if (!elementId || !session) return null;

  const editingPeers = session.peers
    .filter((peer) => peer.activeElementId === elementId)
    .map((peer) => peer.user);

  if (editingPeers.length === 0) return null;

  return (
    <div className="flex items-start gap-2 px-3 py-2 bg-amber-500/10
                    border-b border-amber-500/20 shrink-0">
      <Users className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
      <div className="text-[11px] leading-relaxed">
        {buildWarningMessage(editingPeers, t)}
      </div>
    </div>
  );
}
