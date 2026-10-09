import { MemoryRoomStore } from "./memory.js";
import { RedisRoomStore } from "./redis.js";
import type { RoomStore } from "./types.js";

export interface StoreFactory {
  name: string;
  make: () => Promise<RoomStore>;
  /** Wait until asynchronously fanned-out events have arrived. */
  settle: () => Promise<void>;
}

/** Stores the contract suite runs against: memory always, Redis when REDIS_URL is set. */
export function storeFactories(): StoreFactory[] {
  const factories: StoreFactory[] = [
    {
      name: "memory",
      make: async () => new MemoryRoomStore(),
      settle: async () => {},
    },
  ];
  const url = process.env.REDIS_URL;
  if (url) {
    factories.push({
      name: "redis",
      make: async () => {
        const store = new RedisRoomStore(url, { namespace: `test-${process.pid}:` });
        await store.ready();
        return store;
      },
      // Stream fan-out polls with a short block; give it a few rounds.
      settle: () => new Promise((resolve) => setTimeout(resolve, 300)),
    });
  }
  return factories;
}
