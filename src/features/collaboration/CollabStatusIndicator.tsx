import { useTranslation } from "react-i18next";
import { Loader2, Wifi, WifiOff } from "lucide-react";
import type { CollabConnectionStatus } from "./types";

interface CollabStatusIndicatorProps {
  status: CollabConnectionStatus;
}

const STATUS_CONFIG = {
  idle: { color: "text-muted-foreground" },
  connecting: { color: "text-amber-500" },
  connected: { color: "text-emerald-500" },
  reconnecting: { color: "text-amber-500" },
  disconnected: { color: "text-destructive" },
  closed: { color: "text-muted-foreground" },
} as const;

export function CollabStatusIndicator({ status }: CollabStatusIndicatorProps) {
  const { t } = useTranslation();
  const config = STATUS_CONFIG[status];

  const label = {
    idle: t("collaboration.status.idle"),
    connecting: t("collaboration.status.connecting"),
    connected: t("collaboration.status.connected"),
    reconnecting: t("collaboration.status.reconnecting"),
    disconnected: t("collaboration.status.disconnected"),
    closed: t("collaboration.status.closed"),
  }[status];

  return (
    <div className={`flex items-center gap-1.5 text-xs ${config.color}`}>
      {status === "connecting" || status === "reconnecting" ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : status === "connected" ? (
        <Wifi className="h-3 w-3" />
      ) : (
        <WifiOff className="h-3 w-3" />
      )}
      <span>{label}</span>
    </div>
  );
}
