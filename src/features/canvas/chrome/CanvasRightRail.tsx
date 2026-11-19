import { Suspense, lazy } from "react";
import type { Node } from "@xyflow/react";
import { Minimize2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FloatingChatButton } from "@/features/llm/components/FloatingChatButton";
import ElementPanel from "../panels/ElementPanel/index";
import type { CanvasVisualState } from "../hooks/useCanvasVisualState";
import type { CanvasChat } from "./useCanvasChat";

// The chat UI (@assistant-ui/*) loads when the panel first opens, not with the canvas.
const AssistantUIChatPanel = lazy(() =>
  import("@/features/llm/components/AssistantUIChatPanel").then((m) => ({
    default: m.AssistantUIChatPanel,
  })),
);

interface CanvasRightRailProps {
  focusMode?: boolean;
  onToggleFocusMode?: () => void;
  chat: CanvasChat;
  /** The chat button and panel; off in the editable embed, whose host has its own assistant. */
  showChat: boolean;
  showElementPanel: boolean;
  visualState: CanvasVisualState;
  selectedNodes: Node[];
  focusTitleTrigger: number;
  onFocusElement: (componentId: string) => void;
  onTogglePanelCollapse: (panelId: string) => void;
  onClosePanel: () => void;
}

/** The right edge of the canvas: exit focus mode, the chat button, the element panel and the chat panel. */
export function CanvasRightRail({
  focusMode,
  onToggleFocusMode,
  chat,
  showChat,
  showElementPanel,
  visualState,
  selectedNodes,
  focusTitleTrigger,
  onFocusElement,
  onTogglePanelCollapse,
  onClosePanel,
}: CanvasRightRailProps) {
  const { t } = useTranslation();
  return (
    <div className="absolute inset-y-0 right-0 z-20 flex items-stretch h-full">
      <div className="pointer-events-none flex h-full min-h-0 flex-col items-end">
        {focusMode && onToggleFocusMode ? (
          <div className="shrink-0 pt-4 pr-4">
            <button
              type="button"
              onClick={onToggleFocusMode}
              className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/90 px-3 py-2 text-xs font-medium text-muted-foreground backdrop-blur-sm transition-colors hover:bg-surface-hover hover:text-foreground"
              title={t("canvasToolbar.exitFocusMode")}
            >
              <Minimize2 className="h-3.5 w-3.5" aria-hidden />
              {t("canvasToolbar.exitFocusMode")}
            </button>
          </div>
        ) : null}
        {showChat && (
          <div className="mt-auto flex pb-5 pr-4">
            <div className="pointer-events-auto">
              <FloatingChatButton
                isOpen={chat.isOpen}
                hasUnread={chat.hasUnread}
                onClick={chat.toggle}
              />
            </div>
          </div>
        )}
      </div>
      {showElementPanel && (
        <ElementPanel
          key={visualState.selectedNodeId ?? visualState.selectedEdgeId ?? "multi"}
          selectedElementId={visualState.selectedNodeId}
          selectedEdgeId={visualState.selectedEdgeId}
          selectedNodeIds={Array.from(visualState.selectedNodeIds)}
          selectedNodes={selectedNodes}
          focusTitleTrigger={focusTitleTrigger}
          onFocusElement={onFocusElement}
          onTogglePanelCollapse={onTogglePanelCollapse}
          onClose={onClosePanel}
        />
      )}
      {showChat && chat.isOpen ? (
        <Suspense fallback={null}>
          <AssistantUIChatPanel
            onClose={chat.close}
            selectedNodeIds={visualState.selectedNodeIds}
            selectedNodeId={visualState.selectedNodeId}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
