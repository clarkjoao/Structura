import { CARD_MAX_W, CARD_MIN_W } from "../CardNode/constants";

export interface SizeLimits {
  minWidth: number;
  minHeight: number;
  maxWidth?: number;
}

/**
 * How small (and, for a card, how wide) each VSM element and the named line
 * may be resized — on the canvas and in the inspector's size fields alike.
 * The process box is a card, so it takes the C4 card's width bounds.
 */
export const VSM_SIZE_LIMITS: Readonly<Record<string, SizeLimits>> = {
  "vsm-process": { minWidth: CARD_MIN_W, maxWidth: CARD_MAX_W, minHeight: 80 },
  "vsm-external": { minWidth: 90, minHeight: 60 },
  "vsm-inventory": { minWidth: 60, minHeight: 70 },
  "vsm-supermarket": { minWidth: 30, minHeight: 36 },
  "vsm-push": { minWidth: 50, minHeight: 20 },
  "vsm-kaizen": { minWidth: 70, minHeight: 50 },
  "vsm-timeline": { minWidth: 240, minHeight: 80 },
  "flow-divider": { minWidth: 120, minHeight: 24 },
};
