// The chat hooks live in the llm feature; re-exported for canvas consumers.
export {
  useDiagramContext,
  type DiagramContextResult,
} from "@/features/llm/hooks/useDiagramContext";
export { useLLMChat } from "@/features/llm/hooks/useLLMChat";
export { canvasDiagramToolHost, useProvideChatToolHost } from "./diagramToolHost";
