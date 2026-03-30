export {
  API_GROUP_HEADER_H as HEADER_H,
  API_GROUP_ENDPOINT_H as ENDPOINT_H,
  API_GROUP_FOOTER_H as FOOTER_H,
  API_GROUP_FRAME_W as FRAME_W,
} from "@/features/diagram/model/layout.constants";

export const METHOD_COLORS: Record<string, string> = {
  GET: "#1D9E75",
  POST: "#378ADD",
  PUT: "#BA7517",
  PATCH: "#7F77DD",
  DELETE: "#E24B4A",
  EVENT: "#1D9E75",
};

export const PROTOCOL_COLORS: Record<string, string> = {
  REST: "#1D9E75",
  gRPC: "#378ADD",
  GraphQL: "#D4537E",
  WebSocket: "#BA7517",
};
