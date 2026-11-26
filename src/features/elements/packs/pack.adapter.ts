import type { IconResolver } from "@/features/cloud/model/cloud.types";
import type { ExportNode } from "@/lib/export-core";
import type { Component } from "@/features/diagram/model/component.types";
import type { CloudFamilyDefinition } from "../families/cloud-family.types";
import type { ElementInspectorSlice, ElementTypeId, ExportGeometry } from "../element.types";
import type { ElementPack, PackService } from "./pack.schema";

/** What an adapter's export is told besides the component and its geometry. */
export interface PackExportContext {
  pack: ElementPack;
  /** The pack service the component draws, when it has one. */
  service: PackService | undefined;
  /** Draw.io data URI of the service's icon, when the icon is available synchronously. */
  iconDataUri: string | null;
}

/**
 * The part of a family that is not data.
 *
 * A pack names *what* its elements are; the adapter says how the few that need code do their
 * job: where the icons come from (an npm icon set, the pack's own SVGs), a native export (AWS's
 * mxgraph icons), and the guard that narrows a legacy family's type ids. A pack with no adapter
 * of its own gets `genericPackAdapter` — pack SVGs, image-or-passthrough export.
 */
export interface PackAdapter {
  /** Icons for the canvas and the pickers; absent uses the icons given to the loader. */
  icons?: IconResolver;
  /** Sync icon markup for export; absent uses the icons given to the loader. */
  iconDataUri?: (iconName: string) => string | null;
  /**
   * The registered type of a category id written in the pack. Required for verbatim packs: the
   * family's own guard is what turns `"aws-compute"` into its `AwsCategoryId` without a cast.
   */
  typeIdOf?: (typeId: string) => ElementTypeId | undefined;
  /** Builds the component for a category; absent writes `type` and the catalog service. */
  attachService?: CloudFamilyDefinition["attachService"];
  /** Replaces the default image / passthrough export. */
  toExportNode?: (comp: Component, base: ExportGeometry, context: PackExportContext) => ExportNode;
  patchableKeys?: readonly string[];
  inspector?: ElementInspectorSlice;
}

export const genericPackAdapter: PackAdapter = {};
