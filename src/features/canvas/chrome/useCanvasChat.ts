import { useCallback, useEffect, useRef, useState } from "react";
import { useLLMStore } from "@/features/llm";

export interface CanvasChat {
  isOpen: boolean;
  hasUnread: boolean;
  /** The floating button: opens or closes the panel; refused while a flow is active. */
  toggle: () => void;
  close: () => void;
}

/**
 * The assistant panel beside the canvas: open or not, and whether a reply came
 * in while it was closed. A flow takes the canvas over, so it closes the panel.
 */
export function useCanvasChat(isFlowActive: boolean): CanvasChat {
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const previousAssistantMessageCountRef = useRef(0);
  const assistantMessageCount = useLLMStore(
    (state) => state.messages.filter((message) => message.role === "assistant").length,
  );

  useEffect(() => {
    const hasNewAssistantMessage = assistantMessageCount > previousAssistantMessageCountRef.current;
    if (hasNewAssistantMessage && !isOpen) {
      setHasUnread(true);
    }
    previousAssistantMessageCountRef.current = assistantMessageCount;
  }, [assistantMessageCount, isOpen]);

  useEffect(() => {
    if (isFlowActive && isOpen) {
      setIsOpen(false);
    }
  }, [isFlowActive, isOpen]);

  const toggle = useCallback(() => {
    if (isFlowActive) return;
    setIsOpen((previous) => {
      const next = !previous;
      if (next) {
        setHasUnread(false);
      }
      return next;
    });
  }, [isFlowActive]);
  const close = useCallback(() => setIsOpen(false), []);

  return { isOpen, hasUnread, toggle, close };
}
