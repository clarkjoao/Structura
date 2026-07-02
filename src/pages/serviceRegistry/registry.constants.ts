import { ServiceSource } from "@/features/diagram";

export const SOURCE_DOT: Record<ServiceSource, string> = {
  [ServiceSource.Manual]: "bg-violet-500",
  [ServiceSource.Github]: "bg-blue-500",
  [ServiceSource.Defectdojo]: "bg-orange-500",
};

export const SOURCE_BADGE: Record<ServiceSource, string> = {
  [ServiceSource.Manual]: "bg-violet-500/10 text-violet-400 border border-violet-500/20",
  [ServiceSource.Github]: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  [ServiceSource.Defectdojo]: "bg-orange-500/10 text-orange-400 border border-orange-500/20",
};
