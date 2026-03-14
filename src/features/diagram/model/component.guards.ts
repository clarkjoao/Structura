import { isAwsType } from "@/lib/catalogs/aws";
import type { Component, C4Component, PanelComponent, NoteComponent, AwsComponent } from "./component.types";

export const isPanelComponent = (c: Component): c is PanelComponent => c.type === "panel";

export const isNoteComponent = (c: Component): c is NoteComponent => c.type === "note";

export const isC4Component = (c: Component): c is C4Component =>
  c.type === "person" || c.type === "system" || c.type === "container" || c.type === "component";

export const isAwsComponent = (c: Component): c is AwsComponent => isAwsType(c.type);
