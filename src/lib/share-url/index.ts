/**
 * Share-url: encode/decode diagrams into URL hashes for sharing.
 *
 * Split into:
 * - encode.ts    — compress + generate a share link
 * - decode.ts    — parse a share link from the URL
 * - viewer.ts    — standalone viewer URL helpers
 * - utils.ts     — shared URL helpers (getBasePath, getAppBaseUrl, getAppUrl, currentHashParams)
 */
export { generateShareUrl, getFlowParamFromUrl, type ShareUrlResult } from "./encode";

export {
  decodeShareParam,
  decodeSharePayload,
  getShareParamFromUrl,
  decodeDiagramPayload,
  splitSharedPayload,
} from "./decode";

export { getViewerPostMessageUrl, generateViewerUrl, getViewerPayloadFromHash } from "./viewer";

export { getAppBaseUrl } from "./utils";
