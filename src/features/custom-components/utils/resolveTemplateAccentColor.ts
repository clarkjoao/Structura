import type { CustomComponentTemplate } from "../customComponent.types";

type NodeTemplate = CustomComponentTemplate;

export function resolveTemplateAccentColor(baseType: NodeTemplate["baseType"]): string {
  if (baseType === "panel") return "border-l-[3px] border-muted-foreground";
  if (baseType === "note") return "border-l-[3px] border-yellow-400";
  if (baseType.startsWith("aws-")) return "border-l-[3px] border-orange-400";
  return "border-l-[3px] border-blue-500";
}

