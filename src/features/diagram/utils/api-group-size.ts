import {
  API_GROUP_ENDPOINT_H,
  API_GROUP_FOOTER_H,
  API_GROUP_FRAME_W,
  API_GROUP_HEADER_H,
} from "../model/layout.constants";

const API_GROUP_MIN_H = API_GROUP_HEADER_H + API_GROUP_FOOTER_H;

export function computeApiGroupSize(endpointCount: number): { width: number; height: number } {
  return {
    width: API_GROUP_FRAME_W,
    height: Math.max(
      API_GROUP_MIN_H,
      API_GROUP_HEADER_H + endpointCount * API_GROUP_ENDPOINT_H + API_GROUP_FOOTER_H,
    ),
  };
}
