import type { ServiceDefinition } from "@/features/diagram";
import { ServiceSource } from "@/features/diagram";
import {
  AWS_CATEGORIES,
  type AwsCategoryId,
  type AwsService,
} from "@/lib/catalogs/aws";
import { AWS_SPOTLIGHT_IDS } from "./elementPickerModal.constants";

export function resolveAwsSpotlight(): { svc: AwsService; categoryId: AwsCategoryId }[] {
  const out: { svc: AwsService; categoryId: AwsCategoryId }[] = [];
  for (const id of AWS_SPOTLIGHT_IDS) {
    for (const cat of AWS_CATEGORIES) {
      const svc = cat.services.find((s) => s.id === id);
      if (svc) {
        out.push({ svc, categoryId: cat.id as AwsCategoryId });
        break;
      }
    }
  }
  return out;
}

export function shortAwsName(name: string): string {
  return name.replace(/^Amazon |^AWS /, "");
}

export function servicePrimarySource(svc: ServiceDefinition): ServiceSource {
  const ref = svc.sources?.[0];
  if (ref?.type) return ref.type;
  if (svc.source) return svc.source;
  return ServiceSource.Manual;
}

export function registrySourceDotClass(svc: ServiceDefinition): string {
  const src = servicePrimarySource(svc);
  if (src === ServiceSource.Github) return "bg-blue-500";
  if (src === ServiceSource.Defectdojo) return "bg-orange-500";
  return "bg-violet-500";
}
