import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Check, Link, Users, X } from "lucide-react";
import type { CollabSession } from "../types";
import { copyText } from "../utils/copyText";
import { useCollabStore } from "../store/collab.store";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CollabToolbarProps {
  session: CollabSession | null;
  isReady: boolean;
  collabUrl: string;
  participantCount: number;
  maxParticipants: number;
  peerLimitReached?: boolean;
  onStartCollab?: () => void;
  onEndCollab?: () => void;
}

export function CollabToolbar({
  session,
  isReady,
  collabUrl,
  participantCount,
  maxParticipants,
  peerLimitReached: _peerLimitReached,
  onStartCollab,
  onEndCollab,
}: CollabToolbarProps) {
  const { t } = useTranslation();
  const [isCopied, setIsCopied] = useState(false);
  const [endSessionDialogOpen, setEndSessionDialogOpen] = useState(false);
  const following = useCollabStore((state) => state.following);
  const setFollowing = useCollabStore((state) => state.setFollowing);

  const handleCopyLink = async () => {
    if (!collabUrl) return;
    const copied = await copyText(collabUrl);
    if (!copied) {
      window.prompt(t("collaboration.copyLink"), collabUrl);
      return;
    }
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleConfirmEndSession = () => {
    setEndSessionDialogOpen(false);
    onEndCollab?.();
  };

  if (!session) {
    return (
      <button
        type="button"
        onClick={onStartCollab}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-card/90 backdrop-blur-sm px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
      >
        <Users className="h-3.5 w-3.5" />
        {t("collaboration.start")}
      </button>
    );
  }

  const _peerCount = participantCount > 0 ? participantCount - 1 : 0;

  return (
    <>
      <AlertDialog open={endSessionDialogOpen} onOpenChange={setEndSessionDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("collaboration.endSessionForEveryone")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("collaboration.endSessionForEveryoneDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmEndSession}>
              {t("common.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex items-center gap-2 rounded-lg border border-border bg-card/90 backdrop-blur-sm px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span
            className={`h-2 w-2 rounded-full ${isReady ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`}
          />
          <span className="text-xs font-medium text-foreground">
            {participantCount > 0
              ? t("collaboration.onlineCount", { count: participantCount })
              : t("collaboration.waitingPeers")}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {session.peers.slice(0, 8).map((peer, index) => {
            const isFollowed = following === peer.clientId;
            const label = isFollowed
              ? t("collaboration.stopFollowingPeer", { name: peer.user.name })
              : t("collaboration.followPeer", { name: peer.user.name });
            return (
              <button
                type="button"
                key={`${peer.user.id}-${index}`}
                onClick={() => setFollowing(isFollowed ? null : peer.clientId)}
                aria-pressed={isFollowed}
                aria-label={label}
                title={label}
                className="h-5 w-5 rounded-full border-2 border-background flex items-center justify-center text-[8px] text-white font-bold hover:opacity-90"
                style={{
                  backgroundColor: peer.user?.color ?? "#6366f1",
                  // A ring in the peer's colour marks the one being followed.
                  boxShadow: isFollowed ? `0 0 0 2px ${peer.user.color}` : undefined,
                }}
              >
                {peer.user?.name?.[0]?.toUpperCase() ?? "?"}
              </button>
            );
          })}
        </div>

        {participantCount >= maxParticipants && (
          <div
            className="flex items-center gap-1 text-[10px] text-amber-500"
            title={t("collaboration.peerLimitReached")}
          >
            <AlertTriangle className="h-3 w-3" />
          </div>
        )}

        <button
          type="button"
          onClick={handleCopyLink}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          title={t("collaboration.copyLink")}
        >
          {isCopied ? (
            <Check className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <Link className="h-3.5 w-3.5" />
          )}
        </button>
        {session.isHost && (
          <button
            type="button"
            onClick={() => setEndSessionDialogOpen(true)}
            className="flex items-center gap-1 text-xs text-destructive hover:text-destructive/90 transition-colors"
            title={t("collaboration.endSession")}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </>
  );
}
