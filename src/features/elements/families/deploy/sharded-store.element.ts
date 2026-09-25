import { Database } from "lucide-react";
import { createElement } from "react";
import ShardedStoreNode from "@/features/canvas/nodes/DeployNodes/ShardedStoreNode";
import { SPREAD_HANDLES } from "@/features/canvas/nodes/node-types/handle-spec";
import { flowExportColours } from "@/features/canvas/nodes/ProcessNode/flowExportColor";
import SkinnedElementPanel from "@/features/canvas/panels/ElementPanel/SkinnedElementPanel";
import {
  COMPONENT_TYPE_SHARD,
  COMPONENT_TYPE_SHARD_ROUTER,
  COMPONENT_TYPE_SHARDED_STORE,
} from "@/features/diagram/model/component-type-constants";
import { isShardedStoreComponent } from "@/features/diagram/model/component.guards";
import {
  DEFAULT_SHARD_STRATEGY,
  keySpaceSegments,
  shardCount,
  shardsOf,
} from "@/features/diagram/utils/sharded-store";
import i18n from "@/infrastructure/i18n";
import type { ExportNode } from "@/lib/export-core";
import type {
  ShardComponent,
  ShardedStoreComponent,
} from "@/features/diagram/model/component.types";
import type { ElementDescriptor, ElementInspectorProps, ExportGeometry } from "../../element.types";
import {
  DEPLOY_CATEGORY_ID,
  DEPLOY_FAMILY_ID,
  DEPLOY_STORE_ACCENT,
  deployBuildData,
  playbackStyle,
  skinPatchableKeys,
} from "./deploy.shared";

const STORE_W = 600;
const STORE_H = 320;
/** Compact: header, chips and the 6px bar — derived, never stored. */
export const STORE_COMPACT_H = 84;
/** Where the key bar sits in the expanded header, for the export. */
const BAR_Y = 62;
const BAR_H = 26;

function StoreInspector(props: ElementInspectorProps) {
  return createElement(SkinnedElementPanel, props);
}

export const shardedStoreElement: ElementDescriptor = {
  id: COMPONENT_TYPE_SHARDED_STORE,
  family: DEPLOY_FAMILY_ID,
  labelKey: "elements.deploy-sharded-store.label",
  descriptionKey: "elements.deploy-sharded-store.description",

  model: {
    createComponent: (base) => ({ ...base, type: COMPONENT_TYPE_SHARDED_STORE }),
    defaultSize: { width: STORE_W, height: STORE_H },
    defaultZIndex: -1,
    patchableKeys: [
      "strategy",
      "keyExpression",
      "technology",
      "replicationFactor",
      "collapsed",
      ...skinPatchableKeys,
    ],
  },

  canvas: {
    rfType: COMPONENT_TYPE_SHARDED_STORE,
    component: ShardedStoreNode,
    handles: SPREAD_HANDLES,
    role: "container",
    zIndex: -1,
    connectable: true,
    canHaveParent: true,
    canBeParent: true,
    canBeConnectionSource: true,
    // Compact, the height is the header's, not the stored one.
    derivesSize: true,
    acceptsChildren: [COMPONENT_TYPE_SHARD, COMPONENT_TYPE_SHARD_ROUTER],
    collapsible: true,

    buildData: (comp, ctx) => {
      if (!isShardedStoreComponent(comp)) return {};
      const strategy = comp.strategy ?? DEFAULT_SHARD_STRATEGY;
      return {
        ...deployBuildData(comp, ctx),
        strategy,
        keyExpression: comp.keyExpression,
        technology: comp.technology,
        replicationFactor: comp.replicationFactor ?? 1,
        collapsed: comp.collapsed === true,
        shardCount: shardCount(comp.id, ctx.resolvedComponents),
        segments: keySpaceSegments(
          strategy,
          shardsOf(comp.id, ctx.resolvedComponents, ctx.resolvedNodeLayouts),
        ),
        defaultAccent: DEPLOY_STORE_ACCENT,
      };
    },

    buildStyle: (comp, ctx) => {
      if (!isShardedStoreComponent(comp)) return undefined;
      const layout = ctx.resolvedNodeLayouts[comp.id];
      return {
        width: layout?.width ?? STORE_W,
        height: comp.collapsed === true ? STORE_COMPACT_H : (layout?.height ?? STORE_H),
        ...playbackStyle(comp, ctx),
      };
    },
  },

  palette: {
    categoryId: DEPLOY_CATEGORY_ID,
    icon: { kind: "lucide", icon: Database },
    accent: { kind: "token", cssVar: "--gcp-database" },
    searchKeys: ["shard", "sharding", "partition", "database", "mongodb", "vitess", "citus"],
  },

  inspector: { panel: StoreInspector },

  skin: { defaultAccent: DEPLOY_STORE_ACCENT },

  export: {
    drawio: {
      toExportNode: (comp, base, context) => {
        if (!isShardedStoreComponent(comp)) {
          throw new Error(`[elements] sharded-store export received a ${comp.type} component.`);
        }
        const shards = context ? shardsOf(comp.id, context.components, context.layouts) : [];
        return shardedStoreExport(comp, base, shards);
      },
    },
  },
};

/**
 * The store as a draw.io container: the header with its parameters, the key
 * bar as plain segments inside it (representations, not nodes), its shards
 * and router as the container's own cells, and compact as a collapsed
 * container that keeps the expanded box.
 */
function shardedStoreExport(
  store: ShardedStoreComponent,
  base: ExportGeometry,
  shards: ShardComponent[],
): ExportNode {
  const strategy = store.strategy ?? DEFAULT_SHARD_STRATEGY;
  const segments = keySpaceSegments(strategy, shards);
  const barWidth = Math.max(0, base.width - 24);
  let x = 12;
  const representations = segments.map((segment, index) => {
    const rep = {
      id: `${store.id}-key-${index}`,
      label: segment.label,
      x: Math.round(x),
      y: BAR_Y,
      width: Math.max(4, Math.round(segment.share * barWidth - 3)),
      height: BAR_H,
      fillOpacity: segment.emphasis === "light" ? 16 : 28,
    };
    x += segment.share * barWidth;
    return rep;
  });
  const chips = [
    store.technology,
    store.keyExpression,
    `${i18n.t(`deploy.strategy.${strategy}`, { lng: "en" })} · ${shards.length} shards`,
    `RF ${store.replicationFactor ?? 1}`,
  ].filter(Boolean);
  return {
    ...base,
    kind: "container",
    name: store.name,
    label: `${store.name}\n${chips.join(" · ")}`,
    ...(store.collapsed === true
      ? { compact: { width: base.width, height: STORE_COMPACT_H } }
      : {}),
    representations,
    ...flowExportColours(store, DEPLOY_STORE_ACCENT),
  };
}
