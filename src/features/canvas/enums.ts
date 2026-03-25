/** Element picker sidebar category (persisted in localStorage as lastElementCategory) */
export enum ElementCategory {
  All = "all",
  C4 = "c4",
  Canvas = "canvas",
  Aws = "aws",
  Registry = "registry",
  NodeTemplate = "node-template",
}

/** Connection handle side (incoming vs outgoing) */
export enum HandleSide {
  Incoming = "incoming",
  Outgoing = "outgoing",
}

/** Swimlane panel orientation (persisted in SwimlaneStyle.orientation) */
export enum SwimlaneOrientation {
  Horizontal = "horizontal",
  Vertical = "vertical",
}
