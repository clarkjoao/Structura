import { placeGraph } from "@/features/plugins/plugin-place";
import { PLACE_RESULT, type EmbedMessage, type PLACE } from "./protocol";

type PlaceMessage = Extract<EmbedMessage, { type: typeof PLACE }>;

/**
 * The answer to a host's `STRUCTURA_PLACE`: the graph placed by `api.layout.place`'s own
 * implementation, under the message's arrange settings, so a host that places through the embed
 * gets exactly what a plugin gets. Never rejects: a failure is an answer too, or the host would
 * wait forever.
 */
export async function answerPlaceRequest(
  message: PlaceMessage,
): Promise<{ type: typeof PLACE_RESULT; [field: string]: unknown }> {
  try {
    const boxes = await placeGraph({
      graph: message.graph,
      ...(message.previous && { previous: message.previous }),
      ...(message.arrange?.settings && { settings: message.arrange.settings }),
    });
    return { type: PLACE_RESULT, id: message.id, boxes };
  } catch (error: unknown) {
    return {
      type: PLACE_RESULT,
      id: message.id,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
