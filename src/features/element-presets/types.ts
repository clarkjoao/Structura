import type { ComponentType } from "@/features/diagram";

/**
 * A saved preset: an existing element type plus pre-filled data.
 *
 * Renamed from `ElementPreset` (F10 / architecture decision 5).
 * Not a custom shape — it instantiates a type that already exists.
 */
export interface ElementPreset {
  id: string;
  name: string;
  description?: string;

  category?: string;
  baseType: ComponentType;
  data: Record<string, unknown>;
  serviceId?: string;

  /** Schema version of this preset's `data` shape (not the diagram persist schema). */
  templateVersion: number;
  createdAt: number;
  updatedAt: number;
}

export interface ElementPresetStoreState {
  presets: Record<string, ElementPreset>;
  addPreset: (preset: ElementPreset) => void;
  updatePreset: (
    id: string,
    partial: Partial<Omit<ElementPreset, "id" | "createdAt" | "templateVersion">>,
  ) => void;
  deletePreset: (id: string) => void;
  getPresetById: (id: string) => ElementPreset | null;
}
