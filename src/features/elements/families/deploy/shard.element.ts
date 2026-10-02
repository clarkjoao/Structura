import { HardDrive, Shuffle } from "lucide-react";
import { createElement } from "react";
import ShardNode from "@/features/canvas/nodes/DeployNodes/ShardNode";
import ShardRouterNode from "@/features/canvas/nodes/DeployNodes/ShardRouterNode";
import { SPREAD_HANDLES } from "@/features/canvas/nodes/node-types/handle-spec";
import { FLOW_DEFAULT_ACCENT } from "@/features/canvas/nodes/ProcessNode/flowAppearance";
import { flowExportColours } from "@/features/canvas/nodes/ProcessNode/flowExportColor";
import SkinnedElementPanel from "@/features/canvas/panels/ElementPanel/SkinnedElementPanel";
import {
  COMPONENT_TYPE_SHARD,
  COMPONENT_TYPE_SHARD_ROUTER,
} from "@/features/diagram/model/component-type-constants";
import {
  isShardComponent,
  isShardRouterComponent,
  isShardedStoreComponent,
} from "@/features/diagram/model/component.guards";
import { replicaMarks } from "@/features/diagram/utils/sharded-store";
import type { ElementDescriptor, ElementInspectorProps } from "../../element.types";
import {
  DEPLOY_CATEGORY_ID,
  DEPLOY_FAMILY_ID,
  DEPLOY_STORE_ACCENT,
  deployBuildData,
  playbackStyle,
  skinPatchableKeys,
} from "./deploy.shared";

const SHARD_W = 180;
const SHARD_H = 80;
const ROUTER_W = 160;
const ROUTER_H = 56;
const AMBER = "hsl(var(--node-person))";

function Inspector(props: ElementInspectorProps) {
  return createElement(SkinnedElementPanel, props);
}

/** A shard of a sharded store. Its copies come from the store's factor. */
export const shardElement: ElementDescriptor = {
  id: COMPONENT_TYPE_SHARD,
  family: DEPLOY_FAMILY_ID,
  labelKey: "elements.deploy-shard.label",
  descriptionKey: "elements.deploy-shard.description",

  model: {
    createComponent: (base) => ({ ...base, type: COMPONENT_TYPE_SHARD }),
    defaultSize: { width: SHARD_W, height: SHARD_H },
    patchableKeys: ["keyRange", "share", "region", "hot", ...skinPatchableKeys],
  },

  canvas: {
    rfType: COMPONENT_TYPE_SHARD,
    component: ShardNode,
    handles: SPREAD_HANDLES,
    role: "custom-shape",
    zIndex: 1,
    connectable: true,
    canHaveParent: true,
    canBeParent: false,
    canBeConnectionSource: true,
    derivesSize: false,

    buildData: (comp, ctx) => {
      if (!isShardComponent(comp)) return {};
      const store = comp.parentId ? ctx.resolvedComponents[comp.parentId] : undefined;
      const inStore = store && isShardedStoreComponent(store) ? store : undefined;
      return {
        ...deployBuildData(comp, ctx),
        keyRange: comp.keyRange,
        region: comp.region,
        hot: comp.hot === true,
        replicas: replicaMarks(inStore?.replicationFactor).replicas,
        // Painted like its store: the store's own accent, else the store default.
        defaultAccent: inStore?.customColor ?? DEPLOY_STORE_ACCENT,
      };
    },

    buildStyle: (comp, ctx) => {
      const layout = ctx.resolvedNodeLayouts[comp.id];
      return {
        width: layout?.width ?? SHARD_W,
        height: layout?.height ?? SHARD_H,
        ...playbackStyle(comp, ctx),
      };
    },
  },

  palette: {
    categoryId: DEPLOY_CATEGORY_ID,
    icon: { kind: "lucide", icon: HardDrive },
    accent: { kind: "token", cssVar: "--gcp-database" },
    searchKeys: ["shard", "partition", "fragmento"],
  },

  inspector: { panel: Inspector },

  skin: { defaultAccent: DEPLOY_STORE_ACCENT },

  export: {
    drawio: {
      toExportNode: (comp, base, context) => {
        if (!isShardComponent(comp)) {
          throw new Error(`[elements] shard export received a ${comp.type} component.`);
        }
        const store = comp.parentId ? context?.components[comp.parentId] : undefined;
        const rf = store && isShardedStoreComponent(store) ? store.replicationFactor : undefined;
        const details = [comp.keyRange, comp.region, `RF ${replicaMarks(rf).replicas + 1}`]
          .filter(Boolean)
          .join(" · ");
        return {
          ...base,
          kind: "stencil",
          name: comp.name,
          shapeStyle: "rounded=1;arcSize=8;absoluteArcSize=1;align=left;spacingLeft=10;",
          label: comp.hot ? `${comp.name} (hot)\n${details}` : `${comp.name}\n${details}`,
          ...flowExportColours(
            comp.hot ? { ...comp, customColor: AMBER } : comp,
            DEPLOY_STORE_ACCENT,
          ),
        };
      },
    },
  },
};

/** The router in front of the shards: 0 or 1 per store. */
export const shardRouterElement: ElementDescriptor = {
  id: COMPONENT_TYPE_SHARD_ROUTER,
  family: DEPLOY_FAMILY_ID,
  labelKey: "elements.deploy-shard-router.label",
  descriptionKey: "elements.deploy-shard-router.description",

  model: {
    createComponent: (base) => ({ ...base, type: COMPONENT_TYPE_SHARD_ROUTER }),
    defaultSize: { width: ROUTER_W, height: ROUTER_H },
    patchableKeys: [...skinPatchableKeys],
  },

  canvas: {
    rfType: COMPONENT_TYPE_SHARD_ROUTER,
    component: ShardRouterNode,
    handles: SPREAD_HANDLES,
    role: "custom-shape",
    zIndex: 1,
    connectable: true,
    canHaveParent: true,
    canBeParent: false,
    canBeConnectionSource: true,
    derivesSize: false,

    buildData: (comp, ctx) => {
      if (!isShardRouterComponent(comp)) return {};
      return deployBuildData(comp, ctx);
    },

    buildStyle: (comp, ctx) => {
      const layout = ctx.resolvedNodeLayouts[comp.id];
      return {
        width: layout?.width ?? ROUTER_W,
        height: layout?.height ?? ROUTER_H,
        ...playbackStyle(comp, ctx),
      };
    },
  },

  palette: {
    categoryId: DEPLOY_CATEGORY_ID,
    icon: { kind: "lucide", icon: Shuffle },
    accent: { kind: "neutral" },
    searchKeys: ["router", "roteador", "mongos", "vtgate", "proxy"],
  },

  inspector: { panel: Inspector },

  skin: { defaultAccent: FLOW_DEFAULT_ACCENT },

  export: {
    drawio: {
      toExportNode: (comp, base) => {
        if (!isShardRouterComponent(comp)) {
          throw new Error(`[elements] shard-router export received a ${comp.type} component.`);
        }
        return {
          ...base,
          kind: "stencil",
          name: comp.name,
          shapeStyle: "rounded=1;arcSize=8;absoluteArcSize=1;",
          label: comp.name,
          ...flowExportColours(comp, FLOW_DEFAULT_ACCENT),
        };
      },
    },
  },
};
