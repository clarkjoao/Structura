import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Check, Copy, Loader2, Users, Wifi, WifiOff } from "lucide-react";
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
import { readPrefs, writePrefs } from "./collabPreferences";
import { copyText } from "./copyText";

interface CollabStartModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diagramId: string;
  diagramName: string;
  onStart: (userName: string, serverUrl: string) => void;
}

type TestStatus = "idle" | "testing" | "ok" | "fail";

function isLocalhostServer(url: string): boolean {
  return url.includes("localhost") || url.includes("127.0.0.1");
}

function testServer(wsUrl: string, timeoutMs = 4000): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    let ws: WebSocket | null = null;

    const settle = (result: boolean) => {
      if (done) return;
      done = true;
      try {
        ws?.close();
      } catch {
        // Ignore close errors.
      }
      resolve(result);
    };

    const timeout = setTimeout(() => settle(false), timeoutMs);

    try {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        clearTimeout(timeout);
        settle(true);
      };
      ws.onerror = () => {
        clearTimeout(timeout);
        settle(false);
      };
      ws.onclose = () => {
        clearTimeout(timeout);
        settle(false);
      };
    } catch {
      clearTimeout(timeout);
      settle(false);
    }
  });
}

export function CollabStartModal({
  open,
  onOpenChange,
  diagramId,
  diagramName,
  onStart,
}: CollabStartModalProps) {
  const { t } = useTranslation();
  const defaults = readPrefs();

  const [userName, setUserName] = useState(defaults.userName);
  const [serverUrl, setServerUrl] = useState(defaults.serverUrl);
  const [isCopied, setIsCopied] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");

  const guestUrl = useMemo(
    () => `${window.location.origin}/collab/${diagramId}`,
    [diagramId],
  );

  const isLocalhost = isLocalhostServer(serverUrl);

  const handleStart = () => {
    const trimmedName = userName.trim();
    if (!trimmedName) return;

    writePrefs({ userName: trimmedName, serverUrl });
    onStart(trimmedName, serverUrl);
    onOpenChange(false);
  };

  const handleCopyLink = async () => {
    const copied = await copyText(guestUrl);
    if (!copied) return;
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleTestServer = async () => {
    setTestStatus("testing");
    const ok = await testServer(serverUrl);
    setTestStatus(ok ? "ok" : "fail");
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
                value={serverUrl}
                onChange={(event) => {
                  setServerUrl(event.target.value);
                  setTestStatus("idle");
                }}
                placeholder="ws://localhost:3000/ws"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleTestServer}
                disabled={testStatus === "testing" || !serverUrl}
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
            {isLocalhost && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-500/90">
                  {t("collaboration.localhostWarning")}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>{t("collaboration.inviteLink")}</Label>
            <div className="flex gap-2">
              <Input
                value={guestUrl}
                readOnly
                className={`font-mono text-xs bg-muted ${isLocalhost ? "border-amber-500/50" : ""}`}
              />
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
            {isLocalhost ? (
              <p className="text-[11px] text-amber-500/90">
                {t("collaboration.localhostInviteWarning")}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                {t("collaboration.inviteLinkHint")}
              </p>
            )}
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
