import { isAwsType } from "@/lib/catalogs/aws";
import type { Component, C4Component, PanelComponent, NoteComponent, AwsComponent, ApiGroupComponent, EndpointComponent } from "./component.types";
import { isPanelType, isNoteType, isC4Type, isApiGroupType, isEndpointType } from "./component-type-constants";

export const isPanelComponent = (c: Component): c is PanelComponent => isPanelType(c.type);

export const isNoteComponent = (c: Component): c is NoteComponent => isNoteType(c.type);

export const isC4Component = (c: Component): c is C4Component => isC4Type(c.type);

export const isAwsComponent = (c: Component): c is AwsComponent => isAwsType(c.type);

export const isApiGroupComponent = (c: Component): c is ApiGroupComponent => isApiGroupType(c.type);

export const isEndpointComponent = (c: Component): c is EndpointComponent => isEndpointType(c.type);
