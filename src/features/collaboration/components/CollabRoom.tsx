import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Loader2, WifiOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Canvas, DiagramFlowProvider, FlowModeProvider } from "@/features/canvas";
import { CollabProvider, useCollab } from "./CollabProvider";
import { CollabCursors } from "./CollabCursors";
import { CollabJoinModal } from "./CollabJoinModal";
import { CollabSessionClosedModal } from "./CollabSessionClosedModal";
import { useActiveDiagram, useDiagramActions } from "@/features/diagram";
import { CollabRoomToolbar } from "./CollabRoomToolbar";
import { useCollabStore } from "../store/collab.store";

function CollabRoomInner() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { session, isReady, status, hostOnline, updateCursor } = useCollab();
  const endReason = useCollabStore((s) => s.endReason);
  const endDetail = useCollabStore((s) => s.endDetail);
  const { importDiagram } = useDiagramActions();
  const diagram = useActiveDiagram();
  const hostName = useCollabStore((s) => s.hostName) ?? t("collaboration.hostFallback");
  const isSessionClosed = endReason !== null;
  const lastCursorAtRef = useRef(0);

  const handleCanvasPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!session) return;

      const now = performance.now();
      if (now - lastCursorAtRef.current >= 33) {
        const rect = event.currentTarget.getBoundingClientRect();
        updateCursor({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        });
        lastCursorAtRef.current = now;
      }
    },
    [session, updateCursor],
  );

  const handleCanvasPointerLeave = useCallback(() => {
    if (!session) return;
    updateCursor(null);
  }, [session, updateCursor]);

  const handleImportAndContinue = () => {
    if (!diagram) {
      navigate("/workspace");
      return;
    }
    try {
      const importedDiagram = importDiagram({
        ...diagram,
        name: t("collaboration.importedDiagramName", {
          name: diagram.name,
          host: hostName,
        }),
      });
      toast.success(t("collaboration.importSuccess", { name: importedDiagram.name }));
      navigate(`/model/${importedDiagram.id}`);
    } catch {
      toast.error(t("collaboration.importError"));
      navigate("/workspace");
    }
  };

  // Until the room's state first arrives there is nothing to show. After that the canvas stays
  // mounted through every reconnect — remounting it is what used to crash the page.
  if (!isReady && !isSessionClosed) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-sm">
          {status === "reconnecting"
            ? t("collaboration.status.reconnecting")
            : !session
              ? t("collaboration.connecting")
              : t("collaboration.syncing")}
        </p>
        <p className="text-xs text-muted-foreground max-w-sm text-center">
          {t("collaboration.localhostHint")}
        </p>
      </div>
    );
  }

  const banner =
    status === "reconnecting"
      ? t("collaboration.reconnectingBanner")
      : !hostOnline
        ? t("collaboration.hostReconnectingBanner", { host: hostName })
        : null;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {diagram ? (
        <>
          <CollabRoomToolbar diagram={diagram} />
          <div
            className="flex flex-1 min-h-0 relative"
            onPointerMove={handleCanvasPointerMove}
            onPointerLeave={handleCanvasPointerLeave}
          >
            <FlowModeProvider>
              <DiagramFlowProvider>
                <Canvas />
              </DiagramFlowProvider>
            </FlowModeProvider>
            {session && <CollabCursors peers={session.peers} />}
            {banner && !isSessionClosed && (
              <div
                role="status"
                className="absolute top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-md border border-amber-500/40 bg-background/95 px-3 py-1.5 text-xs shadow-sm"
              >
                <WifiOff className="h-3.5 w-3.5 text-amber-500" />
                {banner}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center text-muted-foreground" />
      )}
      <CollabSessionClosedModal
        open={isSessionClosed}
        hostName={hostName}
        reason={endReason}
        detail={endDetail}
        canImport={Boolean(diagram)}
        onImportAndContinue={handleImportAndContinue}
        onBackToWorkspace={() => navigate("/workspace")}
      />
    </div>
  );
}

interface CollabRoomSessionProps {
  roomId: string;
}

function CollabRoomSession({ roomId }: CollabRoomSessionProps) {
  const [joined, setJoined] = useState(false);
  const [userName, setUserName] = useState("");
  const [serverUrl, setServerUrl] = useState("");

  const handleJoin = (name: string, wsUrl: string) => {
    setUserName(name);
    setServerUrl(wsUrl);
    setJoined(true);
  };

  if (!joined) {
    return (
      <>
        <div className="flex flex-1 items-center justify-center" />
        <CollabJoinModal open roomId={roomId} onJoin={handleJoin} />
      </>
    );
  }

  return (
    <CollabProvider guestRoomId={roomId} userName={userName} signalingUrl={serverUrl}>
      <CollabRoomInner />
    </CollabProvider>
  );
}

export function CollabRoom() {
  const { t } = useTranslation();
  const { roomId } = useParams<{ roomId: string }>();

  if (!roomId) {
    return (
      <div className="h-screen flex flex-col">
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          {t("collaboration.invalidRoom")}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <CollabRoomSession roomId={roomId} />
    </div>
  );
}
