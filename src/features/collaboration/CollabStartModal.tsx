import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy, Loader2, Users, Wifi, WifiOff } from "lucide-react";
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
import { buildCollabInviteUrl } from "./collabUrl";
import { testSignalingServer } from "./testSignalingServer";

interface CollabStartModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diagramId: string;
  diagramName: string;
  onStart: (userName: string, signalingUrl: string) => void;
}

type TestStatus = "idle" | "testing" | "ok" | "fail";

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
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");

  const guestUrl = buildCollabInviteUrl(window.location.origin, diagramId, signalingUrl);

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

  const handleTestServer = async () => {
    setTestStatus("testing");
    const isOnline = await testSignalingServer(signalingUrl);
    setTestStatus(isOnline ? "ok" : "fail");
    setTimeout(() => setTestStatus("idle"), 4000);
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
            <div className="flex gap-2">
              <Input
                id="collab-ws"
                value={signalingUrl}
                onChange={(event) => {
                  setSignalingUrl(event.target.value);
                  setTestStatus("idle");
                }}
                placeholder="ws://localhost:3000/ws"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleTestServer}
                disabled={testStatus === "testing" || !signalingUrl}
                title={t("collaboration.testServer")}
              >
                {testStatus === "testing" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : testStatus === "ok" ? (
                  <Wifi className="h-4 w-4 text-emerald-500" />
                ) : testStatus === "fail" ? (
                  <WifiOff className="h-4 w-4 text-destructive" />
                ) : (
                  <Wifi className="h-4 w-4" />
                )}
              </Button>
            </div>
            {testStatus === "ok" && (
              <p className="text-[11px] text-emerald-600">
                {t("collaboration.serverOnline")}
              </p>
            )}
            {testStatus === "fail" && (
              <p className="text-[11px] text-destructive">
                {t("collaboration.serverOffline")}
              </p>
            )}
            {testStatus === "idle" && (
              <p className="text-[11px] text-muted-foreground">
                {t("collaboration.signalingHint")}
              </p>
            )}
            {signalingUrl.includes("localhost") && (
              <p className="text-[11px] text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2">
                {t("collaboration.localhostHint")}
              </p>
            )}
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
