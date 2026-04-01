import { defaultStorage } from "./LocalStorageAdapter";
import type { CustomComponentTemplate } from "@/features/custom-components";

const CUSTOM_COMPONENTS_STORAGE_KEY = "custom_components";

export class CustomComponentRepository {
  async save(templates: Record<string, CustomComponentTemplate>): Promise<void> {
    await defaultStorage.save(CUSTOM_COMPONENTS_STORAGE_KEY, templates);
  }

  async load(): Promise<Record<string, CustomComponentTemplate>> {
    const loaded = await defaultStorage.load<Record<string, CustomComponentTemplate>>(
      CUSTOM_COMPONENTS_STORAGE_KEY,
    );
    return loaded ?? {};
  }
}

export const customComponentRepository = new CustomComponentRepository();
