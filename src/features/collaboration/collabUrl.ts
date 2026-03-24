const WS_PARAM = "ws";

/**
 * Builds guest invite URL with optional signaling server query param.
 */
export function buildCollabInviteUrl(
  origin: string,
  roomId: string,
  signalingUrl: string,
): string {
  const url = new URL(`${origin}/collab/${roomId}`);
  if (signalingUrl) {
    url.searchParams.set(WS_PARAM, signalingUrl);
  }
  return url.toString();
}

/**
 * Reads signaling server URL from query params.
 */
export function readSignalingUrlFromParams(search: string = window.location.search): string | null {
  const params = new URLSearchParams(search);
  const ws = params.get(WS_PARAM);
  return ws ? decodeURIComponent(ws) : null;
}
