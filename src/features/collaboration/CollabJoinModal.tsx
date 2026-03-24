import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Users } from "lucide-react";
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
              placeholder="ws://localhost:4444"
            />
            <p className="text-[11px] text-muted-foreground">
              {t("collaboration.signalingHint")}
            </p>
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
