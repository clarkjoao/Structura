import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Users } from "lucide-react";
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
import { readSignalingUrlFromParams } from "./collabUrl";
import { isLocalhostSignaling } from "./resolveDefaultSignalingUrl";

interface CollabJoinModalProps {
  open: boolean;
  roomId: string;
  onJoin: (userName: string, signalingUrl: string) => void;
}

export function CollabJoinModal({ open, roomId, onJoin }: CollabJoinModalProps) {
  const { t } = useTranslation();
  const defaultPreferences = readCollabPreferences();
  const signalingUrlFromParams = readSignalingUrlFromParams();
  const [userName, setUserName] = useState(defaultPreferences.userName);
  const [signalingUrl, setSignalingUrl] = useState(
    signalingUrlFromParams ?? defaultPreferences.signalingUrl,
  );

  const isLocalhost = isLocalhostSignaling(signalingUrl);

  const handleJoin = () => {
    const trimmedName = userName.trim();
    if (!trimmedName) return;
    writeCollabPreferences({ userName: trimmedName, signalingUrl });
    onJoin(trimmedName, signalingUrl);
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-md"
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {t("collaboration.joinSession")}
          </DialogTitle>
          <DialogDescription>
            {t("collaboration.joinSessionDesc", { roomId })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="guest-name">{t("collaboration.yourName")}</Label>
            <Input
              id="guest-name"
              value={userName}
              onChange={(event) => setUserName(event.target.value)}
              placeholder={t("collaboration.namePlaceholder")}
              autoFocus
              onKeyDown={(event) => event.key === "Enter" && handleJoin()}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="guest-ws">{t("collaboration.signalingServer")}</Label>
            <Input
              id="guest-ws"
              value={signalingUrl}
              onChange={(event) => setSignalingUrl(event.target.value)}
              placeholder="ws://localhost:3000/ws"
            />
            <p className="text-[11px] text-muted-foreground">
              {t("collaboration.signalingHint")}
            </p>
            {isLocalhost && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-500/90">
                  {t("collaboration.localhostWarning")}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleJoin} disabled={!userName.trim()}>
            <Users className="h-3.5 w-3.5 mr-1.5" />
            {t("collaboration.joinButton")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
