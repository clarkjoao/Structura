import { Suspense, type CSSProperties } from "react";
import { isAwsIcon, isLucideIcon, isSvgIcon, type IconDefinition } from "@/features/diagram";
import AwsIcon from "@/features/canvas/nodes/AwsIcon";
import { cn } from "@/lib/utils";
import { getLazyLucideIcon, resolveLucideDynamicImportKey } from "./lucideDynamicIcon";

export interface CustomIconRendererProps {
  icon: IconDefinition;
  size?: number;
  className?: string;
}

export function CustomIconRenderer({ icon, size = 32, className }: CustomIconRendererProps) {
  if (isSvgIcon(icon)) {
    return (
      <div
        style={{ width: size, height: size, pointerEvents: "none" }}
        className={cn(className)}

        dangerouslySetInnerHTML={{ __html: icon.source.svgContent }}
      />
    );
  }

  if (isLucideIcon(icon)) {
    const dynamicKey = resolveLucideDynamicImportKey(icon.source.iconName);
    if (!dynamicKey) {
      return null;
    }
    const LazyLucideIcon = getLazyLucideIcon(dynamicKey);
    const fallbackStyle: CSSProperties = { width: size, height: size };
    return (
      <Suspense fallback={<div style={fallbackStyle} />}>
        <LazyLucideIcon size={size} className={cn(className)} style={{ pointerEvents: "none" }} />
      </Suspense>
    );
  }

  if (isAwsIcon(icon)) {
    return (
      <div className={cn(className)} style={{ width: size, height: size, pointerEvents: "none" }}>
        <AwsIcon iconName={icon.source.serviceName} size={size} />
      </div>
    );
  }

  return null;
}
