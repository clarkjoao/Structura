import { HEADER_H, FOOTER_H, FRAME_W, ENDPOINT_H } from "./constants";

export { HEADER_H, ENDPOINT_H, FOOTER_H, FRAME_W } from "./constants";

const MIN_H = HEADER_H + FOOTER_H;

export function computeApiGroupSize(endpointCount: number): { width: number; height: number } {
  return {
    width: FRAME_W,
    height: Math.max(MIN_H, HEADER_H + endpointCount * ENDPOINT_H + FOOTER_H),
  };
}
