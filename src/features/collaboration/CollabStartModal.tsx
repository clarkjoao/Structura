import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readCollabPreferences, writeCollabPreferences } from "./collabPreferences";

interface CollabStartModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diagramId: string;
  diagramName: string;
  onStart: (userName: string, signalingUrl: string) => void;
}

export function CollabStartModal({
  open,
  onOpenChange,
  diagramId,
  diagramName,
  onStart,
}: CollabStartModalProps) {
  const { t } = useTranslation();
  const defaultPreferences = readCollabPreferences();
  const [userName, setUserName] = useState(defaultPreferences.userName);
  const [signalingUrl, setSignalingUrl] = useState(defaultPreferences.signalingUrl);
  const [isCopied, setIsCopied] = useState(false);

  const guestUrl = `${window.location.origin}/collab/${diagramId}`;

  const handleStart = () => {
    const trimmedName = userName.trim();
    if (!trimmedName) return;
    writeCollabPreferences({ userName: trimmedName, signalingUrl });
    onStart(trimmedName, signalingUrl);
    onOpenChange(false);
  };

  const handleCopyLink = () => {
    void navigator.clipboard.writeText(guestUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {t("collaboration.startSession")}
          </DialogTitle>
          <DialogDescription>
            {t("collaboration.startSessionDesc", { name: diagramName })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="collab-name">{t("collaboration.yourName")}</Label>
            <Input
              id="collab-name"
              value={userName}
              onChange={(event) => setUserName(event.target.value)}
              placeholder={t("collaboration.namePlaceholder")}
              autoFocus
              onKeyDown={(event) => event.key === "Enter" && handleStart()}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="collab-ws">{t("collaboration.signalingServer")}</Label>
            <Input
              id="collab-ws"
              value={signalingUrl}
              onChange={(event) => setSignalingUrl(event.target.value)}
              placeholder="ws://localhost:4444"
            />
            <p className="text-[11px] text-muted-foreground">
              {t("collaboration.signalingHint")}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>{t("collaboration.inviteLink")}</Label>
            <div className="flex gap-2">
              <Input value={guestUrl} readOnly className="font-mono text-xs bg-muted" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCopyLink}
                title={t("collaboration.copyLink")}
              >
                {isCopied ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {t("collaboration.inviteLinkHint")}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleStart} disabled={!userName.trim()}>
            <Users className="h-3.5 w-3.5 mr-1.5" />
            {t("collaboration.startButton")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
