import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Check, Link, Users, X } from "lucide-react";
import type { CollabSession } from "./types";
import { copyText } from "./copyText";
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
  peerLimitReached?: boolean;
  onStartCollab: () => void;
  onEndCollab?: () => void;
  startDisabled?: boolean;
  startDisabledReason?: string;
}

export function CollabToolbar({
  session,
  isReady,
  collabUrl,
  peerLimitReached,
  onStartCollab,
  onEndCollab,
  startDisabled = false,
  startDisabledReason,
}: CollabToolbarProps) {
  const { t } = useTranslation();
  const [isCopied, setIsCopied] = useState(false);
  const [endSessionDialogOpen, setEndSessionDialogOpen] = useState(false);

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
        disabled={startDisabled}
        title={startDisabled ? startDisabledReason : undefined}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-card/90 backdrop-blur-sm px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors disabled:opacity-50 disabled:pointer-events-none"
      >
        <Users className="h-3.5 w-3.5" />
        {t("collaboration.start")}
      </button>
    );
  }

  const peerCount = session.peers.length;

  return (
    <>
      <AlertDialog open={endSessionDialogOpen} onOpenChange={setEndSessionDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("collaboration.endSessionForEveryone")}</AlertDialogTitle>
            <AlertDialogDescription>{t("collaboration.endSessionForEveryoneDesc")}</AlertDialogDescription>
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
            {peerCount > 0
              ? t("collaboration.onlineCount", { count: peerCount + 1 })
              : t("collaboration.waitingPeers")}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {session.peers.slice(0, 4).map((peer, index) => (
            <div
              key={`${peer.user.id}-${index}`}
              className="h-5 w-5 rounded-full border-2 border-background flex items-center justify-center text-[8px] text-white font-bold"
              style={{ backgroundColor: peer.user?.color ?? "#6366f1" }}
              title={peer.user?.name}
            >
              {peer.user?.name?.[0]?.toUpperCase() ?? "?"}
            </div>
          ))}
        </div>

        {peerLimitReached && (
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
          {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Link className="h-3.5 w-3.5" />}
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
