import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { ReactFlowProvider } from "@xyflow/react";
import { Canvas } from "@/features/canvas";
import { FlowModeProvider } from "@/features/canvas/flow";
import { CollabProvider, useCollab } from "@/features/collaboration";
import { useDiagramStore } from "@/features/diagram/store/diagram.store";

function CollabRoomInner() {
  const { t } = useTranslation();
  const { session, isReady } = useCollab();
  const activeDiagramId = useDiagramStore((state) => state.activeDiagramId);
  const diagrams = useDiagramStore((state) => state.diagrams);
  const diagramExists = Boolean(activeDiagramId && diagrams[activeDiagramId]);

  if (!isReady || !diagramExists) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-sm">
          {!session
            ? t("collaboration.connecting")
            : !isReady
              ? t("collaboration.syncing")
              : t("collaboration.loading")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <FlowModeProvider onFinalize={() => {}}>
        <ReactFlowProvider>
          <Canvas />
        </ReactFlowProvider>
      </FlowModeProvider>
    </div>
  );
}

export default function CollabRoom() {
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
      <CollabProvider guestRoomId={roomId}>
        <CollabRoomInner />
      </CollabProvider>
    </div>
  );
}
