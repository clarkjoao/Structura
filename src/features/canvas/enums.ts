/**
 * Fixed palette tabs (not catalog-shaped families).
 *
 * Cloud family tabs come from `allCloudFamilies()` via each family's
 * `paletteCategoryId` — they must not appear as enum members here.
 */
export enum ElementCategory {
  All = "all",
  C4 = "c4",
  Canvas = "canvas",
  Services = "services",
  NodeTemplate = "node-template",
  Flowchart = "flowchart",
}

/** Active picker tab: a fixed `ElementCategory` or a registered family id. */
export type PickerCategoryId = ElementCategory | (string & {});

export enum HandleSide {
  Incoming = "incoming",
  Outgoing = "outgoing",
}

export enum SwimlaneOrientation {
  Horizontal = "horizontal",
  Vertical = "vertical",
}
