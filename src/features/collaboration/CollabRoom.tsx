import { useState } from "react";
import { Loader2, WifiOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { ReactFlowProvider } from "@xyflow/react";
import { toast } from "sonner";
import { Canvas } from "@/features/canvas";
import { FlowModeProvider } from "@/features/canvas/flow";
import { CollabProvider, useCollab } from "./CollabProvider";
import { CollabJoinModal } from "./CollabJoinModal";
import { CollabSessionClosedModal } from "./CollabSessionClosedModal";
import { useDiagramActions } from "@/features/diagram";
import { useDiagramStore } from "@/features/diagram/store/diagram.store";
import { CollabRoomToolbar } from "./CollabRoomToolbar";

function CollabRoomInner() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { session, isReady, status, sessionClosedByHost } = useCollab();
  const { importDiagram } = useDiagramActions();
  const activeDiagramId = useDiagramStore((state) => state.activeDiagramId);
  const diagrams = useDiagramStore((state) => state.diagrams);
  const diagram = activeDiagramId ? diagrams[activeDiagramId] ?? null : null;
  const diagramExists = Boolean(diagram);
  const hostName = session?.isHost ? session.localUser.name : "Host";

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

  if (!isReady || !diagramExists) {
    const isDisconnected = status === "disconnected";
    return (
      <div className="flex flex-col flex-1 items-center justify-center gap-3 text-muted-foreground">
        {isDisconnected ? (
          <WifiOff className="h-6 w-6 text-destructive" />
        ) : (
          <Loader2 className="h-6 w-6 animate-spin" />
        )}
        <p className="text-sm">
          {isDisconnected
            ? t("collaboration.signalingFailed")
            : !session
              ? t("collaboration.connecting")
              : !isReady
                ? t("collaboration.syncing")
                : t("collaboration.loading")}
        </p>
        {isDisconnected && (
          <p className="text-xs text-muted-foreground max-w-sm text-center">
            {t("collaboration.localhostHint")}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <CollabRoomToolbar diagram={diagram} />
      <div className="flex flex-1 min-h-0">
        <FlowModeProvider onFinalize={() => {}}>
          <ReactFlowProvider>
            <Canvas />
          </ReactFlowProvider>
        </FlowModeProvider>
      </div>
      <CollabSessionClosedModal
        open={sessionClosedByHost}
        hostName={hostName}
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
  const [signalingUrl, setSignalingUrl] = useState("");

  const handleJoin = (name: string, wsUrl: string) => {
    setUserName(name);
    setSignalingUrl(wsUrl);
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
    <CollabProvider guestRoomId={roomId} userName={userName} signalingUrl={signalingUrl}>
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
