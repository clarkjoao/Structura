import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Loader2, Users, Wifi, WifiOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { KEY, keyIs } from "@/lib/keyboard-utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readPrefs, writePrefs } from "../utils/collab-preferences";
import { testServer } from "../utils/collab.utils";

interface CollabJoinModalProps {
  open: boolean;
  roomId: string;
  onJoin: (userName: string, serverUrl: string) => void;
}

function isLocalhostServer(url: string): boolean {
  return url.includes("localhost") || url.includes("127.0.0.1");
}

type TestStatus = "idle" | "testing" | "ok" | "fail";

export function CollabJoinModal({ open, roomId, onJoin }: CollabJoinModalProps) {
  const { t } = useTranslation();
  const defaults = readPrefs();

  const [userName, setUserName] = useState(defaults.userName);
  const [serverUrl, setServerUrl] = useState(defaults.serverUrl);
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [hasTested, setHasTested] = useState(false);

  const isLocalhost = isLocalhostServer(serverUrl);

  const handleJoin = () => {
    const trimmedName = userName.trim();
    if (!trimmedName || !hasTested) return;

    writePrefs({ userName: trimmedName, serverUrl });
    onJoin(trimmedName, serverUrl);
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-md" onPointerDownOutside={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {t("collaboration.joinSession")}
          </DialogTitle>
          <DialogDescription>{t("collaboration.joinSessionDesc", { roomId })}</DialogDescription>
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
              onKeyDown={(event) => keyIs(event, KEY.ENTER) && handleJoin()}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="guest-ws">{t("collaboration.signalingServer")}</Label>
            <div className="flex gap-2">
              <Input
                id="guest-ws"
                value={serverUrl}
                onChange={(event) => {
                  setServerUrl(event.target.value);
                  setTestStatus("idle");
                  setHasTested(false);
                }}
                placeholder="ws://localhost:3000/ws"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={async () => {
                  setTestStatus("testing");
                  const ok = await testServer(serverUrl);
                  setTestStatus(ok ? "ok" : "fail");
                  setHasTested(ok);
                }}
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
              <p className="text-[11px] text-emerald-600">{t("collaboration.serverOnline")}</p>
            )}
            {testStatus === "fail" && (
              <p className="text-[11px] text-destructive">{t("collaboration.serverOffline")}</p>
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
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleJoin} disabled={!userName.trim() || !hasTested}>
            <Users className="h-3.5 w-3.5 mr-1.5" />
            {t("collaboration.joinButton")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
