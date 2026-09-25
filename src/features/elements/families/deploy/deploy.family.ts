import type { ElementDescriptor } from "../../element.types";
import { shardElement, shardRouterElement } from "./shard.element";
import { shardedStoreElement } from "./sharded-store.element";

/**
 * Deployment components: typed containers and their children. Its own family
 * (a vocabulary of its own), registered through `registerElement`, so it gets
 * a picker tab and an LLM catalog heading from the registry alone.
 */
export const deployElements: readonly ElementDescriptor[] = [
  shardedStoreElement,
  shardElement,
  shardRouterElement,
];
