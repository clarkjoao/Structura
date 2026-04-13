import { vi } from "vitest";
import { InMemoryAdapter } from "@/infrastructure/persistence";
import { createDiagramStore } from "./diagram.store";

export function createTestDiagramStore() {
  const mockIconStore = {
    getState: () => ({
      addIcon: vi.fn(),
      removeIcon: vi.fn(),
      updateIconName: vi.fn(),
      incrementIconUsage: vi.fn(),
      decrementIconUsage: vi.fn(),
      icons: {},
      getIconById: vi.fn(),
    }),
  };
  return createDiagramStore(new InMemoryAdapter(), mockIconStore);
}
