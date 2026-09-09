/**
 * Share-url: encode/decode diagrams into URL hashes for sharing.
 *
 * Split into:
 * - encode.ts  — compress + generate a share link
 * - decode.ts  — parse a share link from the URL
 * - viewer.ts  — standalone viewer URL helpers
 */
export {
  generateShareUrl,
  getAppUrl,
  getFlowParamFromUrl,
  encodeDiagramPayload,
  type ShareUrlResult,
} from "./encode";

export { decodeShareParam, getShareParamFromUrl, decodeDiagramPayload } from "./decode";

export { getViewerPostMessageUrl, generateViewerUrl, getViewerDataFromHash } from "./viewer";
