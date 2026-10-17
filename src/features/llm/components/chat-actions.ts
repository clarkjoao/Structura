import { createContext, useContext } from "react";

/**
 * What a rendered message part can ask the chat panel to do. Message parts are
 * rendered by assistant-ui, below the panel, so the panel provides these.
 */
export interface ChatActions {
  openSettings: () => void;
  /** Requests a new reply in place of this assistant message (Retry, Regenerate). */
  rerun: (assistantMessageId: string) => void;
}

const noop = () => undefined;

export const ChatActionsContext = createContext<ChatActions>({ openSettings: noop, rerun: noop });

export function useChatActions(): ChatActions {
  return useContext(ChatActionsContext);
}
