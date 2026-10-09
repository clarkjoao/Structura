import type { TFunction } from "i18next";
import type { CollabEndReason } from "../types";

/**
 * Sizes on the wire are counted in characters of the serialised diagram; shown as MB, which is
 * what they are for the plain-ASCII bulk of a diagram.
 */
const MB = 1024 * 1024;

/** The sentence that tells a participant why their session ended. */
export function endReasonMessage(
  t: TFunction,
  reason: CollabEndReason | null,
  detail: { size?: number; limit?: number } | null | undefined,
  hostName: string,
): string {
  switch (reason) {
    case "host_timeout":
      return t("collaboration.hostDisconnectedDesc", { host: hostName });
    case "room_unknown":
      return t("collaboration.ended.roomUnknown");
    case "room_full":
      return t("collaboration.roomFullDesc", { limit: detail?.limit ?? 50 });
    case "protocol_mismatch":
      return t("collaboration.ended.updateRequired");
    case "too_large":
      return t("collaboration.ended.tooLarge", {
        size: ((detail?.size ?? 0) / MB).toFixed(1),
        limit: ((detail?.limit ?? 0) / MB).toFixed(0),
      });
    case "invalid_seed":
      return t("collaboration.ended.invalidSeed");
    case "unauthorized":
      return t("collaboration.ended.unauthorized");
    case "unreachable":
      return t("collaboration.ended.unreachable");
    default:
      return t("collaboration.sessionEndedDesc", { host: hostName });
  }
}
