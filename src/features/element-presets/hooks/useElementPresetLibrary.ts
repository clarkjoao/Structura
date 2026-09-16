import { useMemo } from "react";
import { useAllServices, useDiagramActions } from "@/features/diagram";
import { useElementPresetStore } from "../store/element-presets.store";
import { buildComponentPatchFromPreset } from "../utils/element-preset.utils";

interface InstantiatePresetParams {
  presetId: string;
  position: { x: number; y: number };
}

export function useElementPresetLibrary() {
  const { addComponent, updateComponent } = useDiagramActions();
  const services = useAllServices();
  const presetsMap = useElementPresetStore((state) => state.presets);
  const addPreset = useElementPresetStore((state) => state.addPreset);
  const updatePreset = useElementPresetStore((state) => state.updatePreset);
  const deletePreset = useElementPresetStore((state) => state.deletePreset);

  const presets = useMemo(
    () => Object.values(presetsMap).sort((a, b) => b.updatedAt - a.updatedAt),
    [presetsMap],
  );
  const serviceIds = useMemo(() => new Set(services.map((service) => service.id)), [services]);

  const instantiatePreset = ({ presetId, position }: InstantiatePresetParams): string | null => {
    const preset = presetsMap[presetId];
    if (!preset) return null;
    const nameFromData = typeof preset.data.name === "string" ? preset.data.name : preset.name;
    const component = addComponent(preset.baseType, nameFromData, null, position);
    const hasRegistryService = preset.serviceId ? serviceIds.has(preset.serviceId) : false;
    const patch = buildComponentPatchFromPreset(preset, hasRegistryService);
    updateComponent(component.id, patch);
    return component.id;
  };

  return {
    presets,
    addPreset,
    updatePreset,
    deletePreset,
    instantiatePreset,
  };
}
