import type { NodeTypes } from "@xyflow/react";
import type { IconResolver } from "@/features/cloud/model/cloud.types";
import type { Component } from "@/features/diagram/model/component.types";
import type { NodeHandleSpec } from "@/features/canvas/nodes/node-types/handle-spec";
import type {
  AccentToken,
  ElementCanvasSlice,
  ElementComponentBase,
  ElementCreateOptions,
  ElementFamilyId,
  ElementInspectorSlice,
  ElementSize,
  ElementTypeId,
  ExportGeometry,
} from "../element.types";
import type { ExportNode } from "@/lib/export-core";

/**
 * Cloud-provider subset of `ElementFamilyId`.
 *
 * Kubernetes and any future non-hyperscaler family stay off this alias until
 * they prove they share the same catalog shape; see
 * `proposta-arquitetura-elementos.md` §2.3(a).
 */
export type CloudFamilyId = Extract<ElementFamilyId, "aws" | "gcp" | "azure">;

/** One catalog row — the unit the palette offers inside a category. */
export interface CloudFamilyService {
  id: string;
  /**
   * Proper-noun display name (Compute Engine, S3, …).
   *
   * Used as the palette variant `labelKey`: cloud service names are not
   * translated today (`CloudBrowseView` renders `svc.name` raw), and i18n
   * returns the key when no entry exists, so the visible label stays the name.
   */
  name: string;
  /** Key the family's `IconResolver` understands. */
  iconName: string;
  categoryId: string;
  /** Optional one-line description for the LLM catalog. */
  descriptionKey?: string;
}

/** One category — becomes one `ElementDescriptor` (the type is the category id). */
export interface CloudFamilyCategory {
  /** Must already be a member of the closed `ComponentType` union. */
  id: ElementTypeId;
  labelKey: string;
  descriptionKey: string;
  /** Declared once here; kills the per-provider `*_CATEGORY_BORDERS` maps. */
  accent: AccentToken;
}

/**
 * Shared card canvas every category of the family paints with.
 *
 * Kept on the family (not hardcoded in the factory) so the factory stays free
 * of a CustomNode import and tests can inject a stub. `rfType` is filled per
 * category as the category id — React Flow needs a distinct key, even when the
 * component is the same.
 */
export interface CloudFamilyCardCanvas {
  component: NodeTypes[string];
  handles: NodeHandleSpec;
  buildData: ElementCanvasSlice["buildData"];
  buildStyle?: ElementCanvasSlice["buildStyle"];
}

/**
 * How a cloud family leaves Structura.
 *
 * Adjustments vs `proposta-arquitetura-elementos.md` §2.3(a):
 * - No `kind: "cloudService"` on the export IR yet — export-core has `image`
 *   and `passthrough` (F2), which are the floor for families without an mxgraph
 *   pack. The family supplies the whole `toExportNode`; the factory copies it
 *   onto every category descriptor.
 * - `import` is omitted until a consumer reads it. GCP has no draw.io import
 *   today; adding a dead field would violate the migration rule.
 */
export interface CloudFamilyExport {
  toExportNode: (comp: Component, base: ExportGeometry) => ExportNode;
}

/**
 * Contract that generates one `ElementDescriptor` per category from a catalog.
 *
 * Illustrative shape from the architecture proposal, corrected against the
 * live `ElementDescriptor` (same spirit as F1–F3d contract fixes):
 *
 * - Persisted service field is `cloudServiceId` (F6b). Creation still takes
 *   `ElementCreateOptions.serviceId` as the create-time input; `attachService`
 *   writes `cloudServiceId`. Catalog business links stay on `BaseComponent.serviceId`.
 * - One descriptor per category, not per service; services become palette
 *   variants.
 * - `icons` keeps the existing `IconResolver` — it already unifies npm packages
 *   (AWS/Azure) and `import.meta.glob` SVGs (GCP).
 */
export interface CloudFamilyDefinition {
  id: CloudFamilyId;
  labelKey: string;
  /** Palette nav id (`ElementCategory.Gcp` → `"gcp"`, …). */
  paletteCategoryId: string;
  categories: readonly CloudFamilyCategory[];
  services: readonly CloudFamilyService[];
  icons: IconResolver;
  card: CloudFamilyCardCanvas;
  export: CloudFamilyExport;
  defaultSize: ElementSize;
  patchableKeys: readonly string[];
  /**
   * Builds the persisted component for a category.
   *
   * Writes `cloudServiceId` (F6b). Creation input remains
   * `ElementCreateOptions.serviceId`.
   */
  attachService: (
    base: ElementComponentBase,
    categoryId: ElementTypeId,
    serviceId: string | undefined,
  ) => Component;
  /** Optional inspector override; absent → generic `ComponentPanel`. */
  inspector?: ElementInspectorSlice;
  /** i18n key for a blank new node's name; blank when absent. */
  defaultNameKey?: string;
}

/** Re-export so callers building `attachService` see the create-options shape. */
export type { ElementCreateOptions };
